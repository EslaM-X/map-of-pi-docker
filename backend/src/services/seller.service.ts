import mongoose, { PipelineStage } from "mongoose";
import Seller from "../models/Seller";
import User from "../models/User";
import UserSettings from "../models/UserSettings";
import SellerItem from "../models/SellerItem";
import { SellerType } from '../models/enums/sellerType';
import { FulfillmentType } from "../models/enums/fulfillmentType";
import { StockLevelType } from '../models/enums/stockLevelType';
import { TrustMeterScale } from "../models/enums/trustMeterScale";
import { getUserSettingsById } from "./userSettings.service";
import { 
  IUser, 
  IUserSettings, 
  ISeller, 
  ISellerItem 
} from "../types";
import logger from "../config/loggingConfig";
import { env } from "../utils/env";

/* Helper Functions */
const buildDefaultSearchFilters = () => {
  return {
    include_active_sellers: true,
    include_inactive_sellers: false,
    include_test_sellers: false,
    include_holiday_sellers: true,
    include_trust_level_100: true,
    include_trust_level_80: true,
    include_trust_level_50: true,
    include_trust_level_0: false,
  }
};

const buildBaseCriteria = (searchFilters: any): Record<string, any> => {
  const criteria: Record<string, any> = { isRestricted: { $ne: true } };

  // [Seller Type Filter]
  const sellerTypeFilters: SellerType[] = [];
  if (searchFilters.include_active_sellers) sellerTypeFilters.push(SellerType.Active);
  if (searchFilters.include_inactive_sellers) sellerTypeFilters.push(SellerType.Inactive);
  if (searchFilters.include_test_sellers) sellerTypeFilters.push(SellerType.Test);
  if (searchFilters.include_holiday_sellers) sellerTypeFilters.push(SellerType.Holiday);

  // include filtered seller types
  if (sellerTypeFilters.length > 0) {
    criteria.seller_type = { $in: sellerTypeFilters };
  }

  return criteria;
};

const buildTrustLevelFilter = (searchFilters: any): TrustMeterScale[] => {
  const trustMap: [keyof typeof searchFilters, TrustMeterScale][] = [
    ["include_trust_level_100", TrustMeterScale.HUNDRED],
    ["include_trust_level_80", TrustMeterScale.EIGHTY],
    ["include_trust_level_50", TrustMeterScale.FIFTY],
    ["include_trust_level_0", TrustMeterScale.ZERO],
  ];
  
  return trustMap
    .filter(([flag]) => searchFilters[flag])
    .map(([, value]) => value);
};

// Fetch all sellers or within a specific bounding box; optional search query.
export const getAllSellers = async (
  bounds?: { sw_lat: number; sw_lng: number; ne_lat: number; ne_lng: number },
  search_query?: string,
  userId?: string,
): Promise<any[]> => {
  const MAX_RESULTS = 50;
  const now = new Date();
  const hasSearch = Boolean(search_query?.trim());

  try {
    /** -------------------------------
     * 1. USER FILTERS (SOURCE OF TRUTH)
     * --------------------------------*/
    const userSettings: IUserSettings | null = userId
      ? await getUserSettingsById(userId)
      : null;

    const searchFilters =
      userSettings?.search_filters ?? buildDefaultSearchFilters();

    const baseCriteria: Record<string, any> = {
      ...buildBaseCriteria(searchFilters),        // seller filters
    };

    /** -------------------------------
     * 2. GEO FILTER (ALWAYS APPLIED)
     * --------------------------------*/
    if (bounds) {
      baseCriteria.sell_map_center = {
        $geoWithin: {
          $geometry: {
            type: "Polygon",
            coordinates: [[
              [bounds.sw_lng, bounds.sw_lat],
              [bounds.ne_lng, bounds.sw_lat],
              [bounds.ne_lng, bounds.ne_lat],
              [bounds.sw_lng, bounds.ne_lat],
              [bounds.sw_lng, bounds.sw_lat],
            ]],
          },
        },
      };
    }
    /** -------------------------------
     * 3. TRUST LEVEL FILTER
     * --------------------------------*/
    const trustLevels = buildTrustLevelFilter(searchFilters);

    /** -------------------------------
     * 4. COMMON LOOKUPS (REUSED)
     * --------------------------------*/
    const lookups: PipelineStage[] = [
      {
        $lookup: {
          from: "users",
          localField: "seller_id",
          foreignField: "pi_uid",
          as: "users",
        },
      },
      { $unwind: { path: "$users", preserveNullAndEmptyArrays: false } },

      {
        $lookup: {
          from: "memberships",
          localField: "seller_id",
          foreignField: "pi_uid",
          as: "membership",
        },
      },
      { $unwind: { path: "$membership", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "user-settings",
          let: { sid: "$seller_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$user_settings_id", "$$sid"] },
                    ...(trustLevels.length
                      ? [{ $in: ["$trust_meter_rating", trustLevels] }]
                      : []),
                  ],
                },
              },
            },
            {
              $project: {
                trust_meter_rating: 1,
                user_name: 1,
              },
            },
          ],
          as: "settings",
        },
      },
      { $unwind: { path: "$settings", preserveNullAndEmptyArrays: false } },

      {
        $lookup: {
          from: "seller-items",
          let: { sid: "$seller_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$seller_id", "$$sid"] },
                    { $gt: ["$expired_by", now] },
                    { $ne: ["$stock_level", StockLevelType.SOLD] },
                  ],
                },
              },
            },
            {
              $project: {
                name: 1,
                description: 1
              },
            },
          ],
          as: "items",
        },
      },
    ];

    /** -------------------------------
     * 5. ATLAS SEARCH PIPELINE
     * --------------------------------*/
    if (env.ATLAS_SEARCH_ENABLED && hasSearch) {
      const pipeline: PipelineStage[] = [
        {
          $search: {
            index: "seller-search",
            compound: {
              must: [
                {
                  text: {
                    query: search_query!,
                    path: [
                      "name",
                      "description",
                      "address",
                      "users.pi_username",
                      "settings.user_name",
                      "items.name",
                      "items.description",
                    ],
                    fuzzy: { maxEdits: 1, prefixLength: 2 },
                  },
                },
              ],
            },
          },
        },

        // ✅ Apply ALL business rules AFTER search
        { $match: baseCriteria },

        { $addFields: { score: { $meta: "searchScore" } } },

        ...lookups,

        {
          $addFields: {
            user_name: "$settings.user_name",
            trust_meter_rating: "$settings.trust_meter_rating",
            membership_class: "$membership.membership_class",
          },
        },

        { $sort: { score: -1, updatedAt: -1 } },
        { $limit: MAX_RESULTS },

        {
          $project: {
            seller_id: 1,
            name: 1,
            image: 1,
            seller_type: 1,
            sell_map_center: 1,
            items: 1,
            user_name: 1,
            trust_meter_rating: 1,
            membership_class: 1,
            score: 1,
          },
        },
      ];

      return await Seller.aggregate(pipeline).exec();
    }

    /** -------------------------------
     * 6. REGEX FALLBACK (NO ATLAS)
     * --------------------------------*/
    const regexPipeline: PipelineStage[] = [
      { $match: baseCriteria },
      ...lookups,
    ];

    if (hasSearch) {
      const tokens = search_query!.trim().split(/\s+/);

      regexPipeline.push({
        $match: {
          $or: [
            { name: { $regex: search_query, $options: "i" } },
            { description: { $regex: search_query, $options: "i" } },
            { address: { $regex: search_query, $options: "i" } },
            { "users.pi_username": { $regex: search_query, $options: "i" } },
            { "settings.user_name": { $regex: search_query, $options: "i" } },
            { "items.name": { $regex: search_query, $options: "i" } },
            { "items.description": { $regex: search_query, $options: "i" } },
            ...tokens.map((t) => ({
              name: { $regex: t, $options: "i" },
            })),
          ],
        },
      });
    }
    regexPipeline.push(
      {
        $addFields: {
          user_name: "$settings.user_name",
          trust_meter_rating: "$settings.trust_meter_rating",
          membership_class: "$membership.membership_class",
        },
      },
      { $sort: { updatedAt: -1 } },
      { $limit: MAX_RESULTS },
      {
        $project: {
          seller_id: 1,
          name: 1,
          image: 1,
          seller_type: 1,
          sell_map_center: 1,
          items: 1,
          user_name: 1,
          trust_meter_rating: 1,
          membership_class: 1,
        },
      },
    );
    return await Seller.aggregate(regexPipeline).exec();
  } catch (err: any) {
    logger.error("Seller aggregation failed", err);
    throw new Error("Failed to retrieve sellers");
  }
};

// Fetch a single seller by ID
export const getSingleSellerById = async (seller_id: string): Promise<ISeller | null> => {
  try {
    const [seller, userSettings, user] = await Promise.all([
      Seller.findOne({ seller_id }).exec(),
      UserSettings.findOne({ user_settings_id: seller_id }).exec(),
      User.findOne({ pi_uid: seller_id }).exec(),
      // TODO SellerItem.find({ seller_id: seller_id }).exec()
    ]);

    if (!seller && !userSettings && !user) {
      return null;
    }

    return {
      sellerShopInfo: seller as ISeller,
      sellerSettings: userSettings as IUserSettings,
      sellerInfo: user as IUser
    } as any;
  } catch (error) {
    logger.error(`Failed to get single seller for sellerID ${ seller_id }: ${ error }`);
    throw error;
  }
};

export const registerOrUpdateSeller = async (authUser: IUser, formData: any): Promise<ISeller> => {
  try {
    const existingSeller = await Seller.findOne({ seller_id: authUser.pi_uid }).exec();

    // Parse and validate sell_map_center from formData
    const sellMapCenter = (formData.sell_map_center && formData.sell_map_center !== 'undefined')
      ? JSON.parse(formData.sell_map_center)
      : existingSeller?.sell_map_center || { type: 'Point', coordinates: [0, 0] };

    // Construct seller object while merging with existing data if necessary
    const sellerData: Partial<ISeller> = {
      seller_id: authUser.pi_uid,
      name: formData.name || existingSeller?.name || authUser.user_name,
      description: formData.description || existingSeller?.description || '',
      seller_type: formData.seller_type || existingSeller?.seller_type || '',
      image: formData.image || existingSeller?.image || '',
      address: formData.address || existingSeller?.address || '',
      sell_map_center: sellMapCenter,
      order_online_enabled_pref: formData.order_online_enabled_pref || existingSeller?.order_online_enabled_pref || false,
      fulfillment_method: formData.fulfillment_method || existingSeller?.fulfillment_method || FulfillmentType.CollectionByBuyer,
      fulfillment_description: formData.fulfillment_description || existingSeller?.fulfillment_description || ''
    };

    // Update existing seller or create a new one
    if (existingSeller) {
      const updatedSeller = await Seller.findOneAndUpdate(
        { seller_id: authUser.pi_uid },
        { $set: sellerData },
        { new: true }
      ).exec();
      logger.debug('Seller updated in the database:', updatedSeller);
      return updatedSeller as ISeller;
    } else {
      const shopName = sellerData.name || authUser.user_name;
      const newSeller = new Seller({
        ...sellerData,
        name: shopName,
        average_rating: 5.0,
        order_online_enabled_pref: false,
      });
      const savedSeller = await newSeller.save();
      logger.info('New seller created in the database:', savedSeller);
      return savedSeller as ISeller;
    }
  } catch (error: any) {
    logger.error(`Failed to register or update seller: ${ error }`);
    throw error;
  }
};

// Delete existing seller
export const deleteSeller = async (seller_id: string | undefined): Promise<ISeller | null> => {
  try {
    const deletedSeller = await Seller.findOneAndDelete({ seller_id }).exec();
    return deletedSeller ? deletedSeller as ISeller : null;
  } catch (error: any) {
    logger.error(`Failed to delete seller for sellerID ${ seller_id }: ${ error }`);
    throw error;
  }
};

export const getAllSellerItems = async (
  seller_id: string,
): Promise<ISellerItem[] | null> => {
  try {
    const existingItems = await SellerItem.find({
      seller_id: seller_id,
    });

    if (!existingItems || existingItems.length == 0) {
      logger.warn('Item list is empty.');
      return null;      
    } 
    logger.info('fetched item list successfully');
    return existingItems as ISellerItem[];
  } catch (error: any) {
    logger.error(`Failed to get seller items for sellerID ${ seller_id }: ${ error }`);
    throw error;
  }
};

export const addOrUpdateSellerItem = async (
  seller: ISeller,
  item: ISellerItem
): Promise<ISellerItem | null> => {

  try {
    const today = new Date();

    // Calculate expiration date based on duration (defaults to 1 week)
    const duration = Number(item.duration) || 1;
    const durationInMs = duration * 7 * 24 * 60 * 60 * 1000;
    const expiredBy = new Date(today.getTime() + durationInMs);

    // Ensure unique identifier is used for finding existing items
    const query = {
      _id: item._id || undefined,
      seller_id: seller.seller_id,
    };

    // Attempt to find the existing item
    const existingItem = await SellerItem.findOne(query);

    if (existingItem) {
      // Update the existing item
      existingItem.set({
        ...item,
        expired_by: expiredBy,
        image: item.image || existingItem.image, // Use existing image if a new one isn't provided
      });
      const updatedItem = await existingItem.save();

      logger.info('Item updated successfully:', { updatedItem });
      return updatedItem;
    } else {
      // Ensure item has a unique identifier for creation
      const newItemId = item._id || new mongoose.Types.ObjectId().toString();

      // Create a new item
      const newItem = new SellerItem({
        _id: newItemId,
        seller_id: seller.seller_id,
        name: item.name ? item.name.trim() : '',
        description: item.description ? item.description.trim() : '',
        price: parseFloat(item.price?.toString() || '0.01'), // Ensure valid price
        stock_level: item.stock_level || StockLevelType.AVAILABLE_1,
        duration: parseInt(item.duration?.toString() || '1'), // Ensure valid duration
        image: item.image,
        expired_by: expiredBy,
      });

      await newItem.save();

      logger.info('Item created successfully:', { newItem });
      return newItem;
    }
  } catch (error: any) {
    logger.error(`Failed to add or update seller item for sellerID ${ seller.seller_id}: ${ error }`);
    throw error;
  }
};

// Delete existing seller item
export const deleteSellerItem = async (id: string): Promise<ISellerItem | null> => {
  try {
    const deletedSellerItem = await SellerItem.findByIdAndDelete(id).exec();
    return deletedSellerItem ? deletedSellerItem as ISellerItem : null;
  } catch (error: any) {
    logger.error(`Failed to delete seller item for itemID ${ id }: ${ error}`);
    throw error;
  }
};