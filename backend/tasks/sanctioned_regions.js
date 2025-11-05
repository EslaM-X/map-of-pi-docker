// usage: node sanctioned_regions.js

const mongoose = require('mongoose');
const dbConnection = require('../build/src/config/dbConnection.js');
const SanctionedRegionModule = require('../build/src/models/misc/SanctionedRegion.js');
const RestrictedAreaBoundariesModule = require('../build/src/models/enums/restrictedArea.js');

// insert sanctioned areas into MongoDB
const insertSanctionedRegions = async () => {
  const SanctionedRegion = SanctionedRegionModule.default;
  const RestrictedAreaBoundaries = RestrictedAreaBoundariesModule.RestrictedAreaBoundaries;

  try {
    await dbConnection.connectDB();

    const regions = Object.entries(RestrictedAreaBoundaries).map(([key, boundary]) => ({
      location: key,
      boundary,
    }));

    await SanctionedRegion.deleteMany(); // clear existing data
    await SanctionedRegion.insertMany(regions); // insert new data

    console.log('Inserted sanctioned regions into MongoDB');
  } catch (error) {
    console.error("Error inserting sanctioned regions:", error.message);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

 // Call the function to insert sanctioned regions
insertSanctionedRegions();