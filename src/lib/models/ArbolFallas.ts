import mongoose, { Schema, Document } from "mongoose";
import { IArbolFallas, ICatalogoModo, ICatalogoCausa } from "@/types";

export interface ArbolFallasDocument extends Omit<IArbolFallas, "_id">, Document {}

const ArbolFallasSchema = new Schema<ArbolFallasDocument>(
  {
    tipoEquipo: { type: String, trim: true, default: null },
    sintoma: { type: String, required: true, trim: true },
    codigoModo: { type: String, trim: true },
    causaProbable: { type: String, required: true, trim: true },
    codigoCausa: { type: String, trim: true },
    resolucionSugerida: { type: String, trim: true, default: "" },
    tiempoEstimadoHrs: { type: Number, default: 0, min: 0 },
    activo: { type: Boolean, default: true },
    creadoPor: { type: String, ref: "Usuario", default: "sistema" },
  },
  { timestamps: true }
);

ArbolFallasSchema.index({ tipoEquipo: 1, sintoma: 1, activo: 1 });
ArbolFallasSchema.index({ tipoEquipo: 1, codigoModo: 1, codigoCausa: 1 }, { unique: true, sparse: true });

export const ArbolFallas =
  mongoose.models.ArbolFallas ||
  mongoose.model<ArbolFallasDocument>("ArbolFallas", ArbolFallasSchema);

// ── Catálogo de Modos ISO 14224 ───────────────────────────────────────────────
export interface CatalogoModoDocument extends Omit<ICatalogoModo, "_id">, Document {}

const CatalogoModoSchema = new Schema<CatalogoModoDocument>({
  codigo:      { type: String, required: true, trim: true, unique: true },
  nombre:      { type: String, trim: true, default: "" },
  nombreEs:    { type: String, trim: true, default: "" },
  descripcion: { type: String, trim: true, default: "" },
});

export const CatalogoModo =
  mongoose.models.CatalogoModo ||
  mongoose.model<CatalogoModoDocument>("CatalogoModo", CatalogoModoSchema);

// ── Catálogo de Causas MSC ────────────────────────────────────────────────────
export interface CatalogoCausaDocument extends Omit<ICatalogoCausa, "_id">, Document {}

const CatalogoCausaSchema = new Schema<CatalogoCausaDocument>({
  codigo:      { type: String, required: true, trim: true, unique: true },
  nombre:      { type: String, required: true, trim: true },
  descripcion: { type: String, trim: true, default: "" },
});

export const CatalogoCausa =
  mongoose.models.CatalogoCausa ||
  mongoose.model<CatalogoCausaDocument>("CatalogoCausa", CatalogoCausaSchema);
