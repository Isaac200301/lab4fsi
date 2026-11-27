import { afterAll, afterEach, beforeAll } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri("folio-test"));
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

afterEach(async () => {
  const colecciones = await mongoose.connection.db!.collections();
  await Promise.all(colecciones.map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
