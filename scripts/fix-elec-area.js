const mongoose = require("mongoose");
async function main() {
  await mongoose.connect("mongodb://localhost:27017/sync-msc");
  const col = mongoose.connection.db.collection("programacionsemanals");
  // Fix ELEC areaCodigo from 3311 to 3319 (Eléctrico Planta)
  const r = await col.updateMany({ disciplina: "ELEC" }, { $set: { areaCodigo: "3319" } });
  console.log("ELEC actualizadas:", r.modifiedCount);
  // Verify
  const sample = await col.findOne({ disciplina: "ELEC" });
  console.log("Muestra ELEC:", sample?.disciplina, sample?.areaCodigo, "S"+sample?.semana);
  await mongoose.disconnect();
}
main().catch(console.error);
