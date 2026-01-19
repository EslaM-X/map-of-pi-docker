// Create this index in Atlas → Search → Create Index:

// index name: seller-search

// set ATLAS_SEARCH_ENABLED=true in env file

const atlas_index_settings = {
  "mappings": {
    "dynamic": false,
    "fields": {
      "name": { "type": "string" },
      "description": { "type": "string" },
      "address": { "type": "string" },

      "isRestricted": { "type": "boolean" },

      "sell_map_center": { "type": "geo" },

      "users": {
        "type": "document",
        "fields": {
          "pi_username": { "type": "string" }
        }
      },

      "settings": {
        "type": "document",
        "fields": {
          "user_name": { "type": "string" },
          "trust_meter_rating": { "type": "number" }
        }
      },

      "items": {
        "type": "document",
        "fields": {
          "name": { "type": "string" },
          "description": { "type": "string" }
        }
      }
    }
  }
}
