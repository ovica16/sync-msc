import mongoose, { Schema, Document, Model } from "mongoose";

export type SentidoInspeccion = "Visual" | "Auditivo" | "Tactil" | "Olfativo" | "Instrumental";

export interface IChecklistItem {
  descripcion: string;
  orden: number;
  sentido: SentidoInspeccion;
}

export interface IChecklistMantto extends Document {
  codigo: string;             // clave única: DISC-CAT-AREA (ej: ELE-MOTORES-GEN)
  areaCodigo: string;         // código área JDE (puede ser "*" = todas)
  nombre: string;
  disciplina: "Mecanico" | "Electrico" | "Instrumentacion" | "Universal";
  nivelTag: number | null;    // 5, 7 o null = cualquiera
  areaProceso: string;        // chancado | molienda | flotacion | filtros | aguas | general
  categoriaISO: string | null;// si está seteado, solo aplica a esa categoría exacta
  items: IChecklistItem[];
  activo: boolean;
}

const ItemSchema = new Schema<IChecklistItem>(
  {
    descripcion: { type: String, required: true },
    orden:       { type: Number, default: 0 },
    sentido:     { type: String, enum: ["Visual", "Auditivo", "Tactil", "Olfativo", "Instrumental"], default: "Visual" },
  },
  { _id: false }
);

const ChecklistManttoSchema = new Schema<IChecklistMantto>(
  {
    codigo:       { type: String, trim: true, default: "" },
    areaCodigo:   { type: String, required: true, default: "*" },
    nombre:       { type: String, required: true },
    disciplina:   { type: String, enum: ["Mecanico", "Electrico", "Instrumentacion", "Universal"], required: true },
    nivelTag:     { type: Number, default: null },
    areaProceso:  { type: String, default: "general" },
    categoriaISO: { type: String, default: null },
    items:        { type: [ItemSchema], default: [] },
    activo:       { type: Boolean, default: true },
  },
  { timestamps: true }
);

ChecklistManttoSchema.index({ disciplina: 1, nivelTag: 1, areaProceso: 1, activo: 1 });
ChecklistManttoSchema.index({ areaCodigo: 1, activo: 1 });

const ChecklistMantto: Model<IChecklistMantto> =
  mongoose.models.ChecklistMantto ||
  mongoose.model<IChecklistMantto>("ChecklistMantto", ChecklistManttoSchema);

export default ChecklistMantto;
