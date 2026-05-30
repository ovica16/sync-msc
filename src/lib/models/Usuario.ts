import mongoose, { Schema, Document } from "mongoose";
import { IUsuario } from "@/types";

export interface UsuarioDocument extends Omit<IUsuario, "_id">, Document {}

const UsuarioSchema = new Schema<UsuarioDocument>(
  {
    nombre: { type: String, required: true, trim: true },
    apellido: { type: String, trim: true },
    // email without unique here — enforced via partial index below
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String },
    rol: { type: Number, required: true, enum: [1, 2, 3, 4, 5] },
    areas: [{ type: String, trim: true }],
    disciplina: { type: String, enum: ["GENERAL", "MEC", "ELEC", "INST"], default: "GENERAL" },
    areaTrabajo: { type: String, trim: true },
    celular: { type: String, trim: true },
    jde: { type: String, trim: true },
    puesto: { type: String, trim: true },
    superintendencia: { type: String, trim: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, autoIndex: true }
);

UsuarioSchema.index({ rol: 1, activo: 1 });
UsuarioSchema.index({ areas: 1 });
UsuarioSchema.index({ jde: 1 });
// Partial unique index: only enforces uniqueness when email is actually set (non-empty)
UsuarioSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string", $gt: "" } } }
);

// Force schema recompilation in dev when schema changes
if (process.env.NODE_ENV !== "production" && mongoose.models.Usuario) {
  delete (mongoose.models as Record<string, unknown>).Usuario;
}

export const Usuario = mongoose.models.Usuario as mongoose.Model<UsuarioDocument> ||
  mongoose.model<UsuarioDocument>("Usuario", UsuarioSchema);
