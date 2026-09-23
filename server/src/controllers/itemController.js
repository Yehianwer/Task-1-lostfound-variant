import Joi from 'joi';
import mongoose from 'mongoose';
import { Item } from '../models/Item.js';

const categories = ['electronics', 'clothing', 'documents', 'accessories', 'other'];
const statuses = ['lost', 'found', 'claimed'];

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return helpers.message('{{#label}} must be a valid MongoDB ObjectId');
  }
  return value;
});

const itemFields = {
  title: Joi.string().trim().min(1),
  description: Joi.string(),
  category: Joi.string().valid(...categories),
  status: Joi.string().valid(...statuses),
  location: Joi.string(),
  reportedBy: objectId
};

const createSchema = Joi.object({
  ...itemFields,
  title: itemFields.title.required()
}).required();

const updateSchema = Joi.object(itemFields).min(1).required();

const filterSchema = Joi.object({
  status: Joi.string().valid(...statuses),
  category: Joi.string().valid(...categories)
});

function validationOptions() {
  return { abortEarly: false, allowUnknown: false };
}

function isValidId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function duplicateResponse(err, res) {
  if (err?.code !== 11000) return false;
  res.status(409).json({ message: 'An item with this title and location already exists' });
  return true;
}

// GET /api/items
export async function getAllItems(req, res, next) {
  try {
    const { value, error } = filterSchema.validate(req.query, validationOptions());
    if (error) return res.status(400).json({ message: error.message });

    const filter = {};
    if (value.status) filter.status = value.status;
    if (value.category) filter.category = value.category;

    const items = await Item.find(filter)
      .sort({ createdAt: -1 })
      .populate('reportedBy', 'name email');
    res.json({ items });
  } catch (err) { next(err); }
}

// GET /api/items/:id
export async function getItem(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item ID' });
    }

    const item = await Item.findById(req.params.id).populate('reportedBy', 'name email');
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ item });
  } catch (err) { next(err); }
}

// POST /api/items
export async function createItem(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body, validationOptions());
    if (error) return res.status(400).json({ message: error.message });

    const item = await Item.create(value);
    res.status(201).json({ item });
  } catch (err) {
    if (duplicateResponse(err, res)) return;
    next(err);
  }
}

// PATCH /api/items/:id
export async function updateItem(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item ID' });
    }

    const { value, error } = updateSchema.validate(req.body, validationOptions());
    if (error) return res.status(400).json({ message: error.message });

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { $set: value },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ item });
  } catch (err) {
    if (duplicateResponse(err, res)) return;
    next(err);
  }
}

// DELETE /api/items/:id
export async function deleteItem(req, res, next) {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid item ID' });
    }

    const item = await Item.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}
