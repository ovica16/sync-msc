import mongoose, { Schema, Document } from "mongoose";
import { IWorkOrder } from "@/types";

export interface WorkOrderDocument extends Omit<IWorkOrder, "_id" | "equipment">, Document {
  equipment: mongoose.Types.ObjectId;
}

const WorkOrderSchema = new Schema<WorkOrderDocument>(
  {
    orderNumber: { type: String, required: true, unique: true, trim: true },
    equipment: { type: Schema.Types.ObjectId, ref: "Equipment", required: true },
    type: {
      type: String,
      enum: ["Preventivo", "Correctivo", "Predictivo", "Inspección"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Pendiente", "En progreso", "Completada", "Cancelada"],
      default: "Pendiente",
    },
    description: { type: String, required: true },
    assignedTo: { type: String, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
  },
  { timestamps: true }
);

export const WorkOrder =
  mongoose.models.WorkOrder ||
  mongoose.model<WorkOrderDocument>("WorkOrder", WorkOrderSchema);
