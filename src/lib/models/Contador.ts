import mongoose, { Schema } from "mongoose";

const ContadorSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 900000 },
});

export const Contador =
  mongoose.models.Contador ||
  mongoose.model("Contador", ContadorSchema);

export async function siguienteNumeroOT(): Promise<string> {
  const doc = await Contador.findByIdAndUpdate(
    "ordenes_trabajo",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return String(doc.seq);
}
