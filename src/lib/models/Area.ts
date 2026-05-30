import mongoose, { Schema, Document } from "mongoose";
import { IArea } from "@/types";

export interface AreaDocument extends Omit<IArea, "_id">, Document {}

const AreaSchema = new Schema<AreaDocument>(
  {
    codigo: { type: String, required: true, unique: true, trim: true },
    nombre: { type: String, required: true, trim: true },
    superintendencia: { type: String, required: true, trim: true },
    tieneCalibracion: { type: Boolean, default: false },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Area =
  mongoose.models.Area ||
  mongoose.model<AreaDocument>("Area", AreaSchema);
