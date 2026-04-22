const Laptop = require('../models/Laptop');

async function findMergeCandidate(incoming) {
  const query = {
    condition: incoming.condition,
    brand: { $regex: new RegExp(`^${incoming.brand}$`, 'i') },
    model: { $regex: new RegExp(`^${incoming.model}$`, 'i') },
    costPrice: incoming.costPrice,
    sellingPrice: incoming.sellingPrice,
    archived: { $ne: true },
  };

  const specFields = ['processor', 'ram', 'storage', 'gpu', 'display', 'os', 'color'];
  for (const field of specFields) {
    if (incoming.specs?.[field]) {
      query[`specs.${field}`] = { $regex: new RegExp(`^${incoming.specs[field]}$`, 'i') };
    }
  }
  if (incoming.modelNumber) {
    query.modelNumber = { $regex: new RegExp(`^${incoming.modelNumber}$`, 'i') };
  }

  const match = await Laptop.findOne(query).select('_id sku quantity').lean();
  return match || null;
}

module.exports = { findMergeCandidate };
