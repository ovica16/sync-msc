const mongoose = require("mongoose");
async function main() {
  await mongoose.connect("mongodb://localhost:27017/sync-msc");
  const col = mongoose.connection.db.collection("programacionsemanals");
  const r = await col.deleteMany({ disciplina: "GENERAL" });
  console.log("GENERAL removidos:", r.deletedCount);
  const counts = await col.aggregate([
    { $group: { _id: "$disciplina", count: { $sum: 1 } } }
  ]).toArray();
  console.log("Registros por disciplina:", counts);
  await mongoose.disconnect();
}
main().catch(console.error);
