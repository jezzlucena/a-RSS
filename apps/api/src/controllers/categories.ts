import type { RequestHandler } from 'express';
import mongoose from 'mongoose';
import { createCategoryRequest, updateCategoryRequest } from '@a-rss/shared';
import { Category } from '../models/category.js';
import { Source } from '../models/source.js';
import { getUserId } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import { serializeCategory } from '../services/serializers.js';

export const listCategories: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const cats = await Category.find({ userId }).sort({ name: 1 });
  res.json(cats.map(serializeCategory));
};

export const createCategory: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const body = createCategoryRequest.parse(req.body);
  try {
    const cat = await Category.create({ userId, name: body.name, color: body.color ?? null });
    res.status(201).json(serializeCategory(cat));
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      throw new HttpError(409, 'category_exists', 'A category with that name already exists');
    }
    throw err;
  }
};

export const updateCategory: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'not_found');
  const body = updateCategoryRequest.parse(req.body);
  const cat = await Category.findOneAndUpdate({ _id: id, userId }, { $set: body }, { new: true });
  if (!cat) throw new HttpError(404, 'not_found');
  res.json(serializeCategory(cat));
};

export const deleteCategory: RequestHandler = async (req, res) => {
  const userId = getUserId(req);
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw new HttpError(404, 'not_found');
  const cat = await Category.findOneAndDelete({ _id: id, userId });
  if (!cat) throw new HttpError(404, 'not_found');
  // Detach sources rather than cascading — user keeps their feeds.
  await Source.updateMany({ userId, categoryId: id }, { $set: { categoryId: null } });
  res.status(204).end();
};
