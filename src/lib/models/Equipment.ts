import mongoose, { Schema, Document } from "mongoose";
import { IEquipment } from "@/types";

export interface EquipmentDocument extends Omit<IEquipment, "_id">, Document {}

const EquipmentSchema = new Schema<EquipmentDocument>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Operativo", "En mantenimiento", "Fuera de servicio"],
      default: "Operativo",
    },
    brand: { type: String, trim: true },
    model: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    installDate: { type: Date },
  },
  { timestamps: true }
);

export const Equipment =
  mongoose.models.Equipment ||
  mongoose.model<EquipmentDocument>("Equipment", EquipmentSchema);
