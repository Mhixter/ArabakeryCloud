import crypto from "crypto";
import { db, branchesTable, usersTable, inventoryItemsTable, productionBatchesTable, salesTable } from "@workspace/db";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  console.log("Starting seed...");

  // Check if already seeded
  const existingUsers = await db.select().from(usersTable).limit(1);
  if (existingUsers.length > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  // Create branches
  const [mainBranch] = await db.insert(branchesTable).values({
    name: "Lagos Mainland",
    address: "12 Broad Street, Lagos Island, Lagos",
    phone: "08012345678",
    isActive: true,
  }).returning();

  const [secondBranch] = await db.insert(branchesTable).values({
    name: "Ikeja Branch",
    address: "5 Allen Avenue, Ikeja, Lagos",
    phone: "08098765432",
    isActive: true,
  }).returning();

  console.log("Branches created:", mainBranch.name, secondBranch.name);

  // Create users
  const users = await db.insert(usersTable).values([
    {
      username: "admin",
      passwordHash: hashPassword("admin123"),
      fullName: "Chukwuemeka Obi",
      role: "managing_director" as const,
      branchId: null,
      isActive: true,
    },
    {
      username: "manager1",
      passwordHash: hashPassword("manager123"),
      fullName: "Adaeze Nwosu",
      role: "manager" as const,
      branchId: mainBranch.id,
      isActive: true,
    },
    {
      username: "receptionist1",
      passwordHash: hashPassword("staff123"),
      fullName: "Fatima Bello",
      role: "receptionist" as const,
      branchId: mainBranch.id,
      isActive: true,
    },
    {
      username: "production1",
      passwordHash: hashPassword("staff123"),
      fullName: "Kehinde Afolabi",
      role: "production_staff" as const,
      branchId: mainBranch.id,
      isActive: true,
    },
    {
      username: "manager2",
      passwordHash: hashPassword("manager123"),
      fullName: "Emeka Eze",
      role: "manager" as const,
      branchId: secondBranch.id,
      isActive: true,
    },
  ]).returning();

  console.log(`${users.length} users created`);

  const productionUser = users.find(u => u.role === "production_staff")!;
  const receptionistUser = users.find(u => u.role === "receptionist")!;

  // Create inventory items
  await db.insert(inventoryItemsTable).values([
    { name: "All-Purpose Flour", category: "Flour", unit: "kg", currentQuantity: "250", minimumQuantity: "50", costPerUnit: "650", branchId: mainBranch.id },
    { name: "Whole Wheat Flour", category: "Flour", unit: "kg", currentQuantity: "80", minimumQuantity: "30", costPerUnit: "750", branchId: mainBranch.id },
    { name: "Active Dry Yeast", category: "Yeast", unit: "kg", currentQuantity: "5", minimumQuantity: "2", costPerUnit: "8500", branchId: mainBranch.id },
    { name: "Refined Sugar", category: "Sugar", unit: "kg", currentQuantity: "120", minimumQuantity: "25", costPerUnit: "450", branchId: mainBranch.id },
    { name: "Table Salt", category: "Salt", unit: "kg", currentQuantity: "20", minimumQuantity: "5", costPerUnit: "200", branchId: mainBranch.id },
    { name: "Vegetable Margarine", category: "Fat/Oil", unit: "kg", currentQuantity: "60", minimumQuantity: "20", costPerUnit: "1200", branchId: mainBranch.id },
    { name: "Eggs", category: "Eggs", unit: "pcs", currentQuantity: "4", minimumQuantity: "24", costPerUnit: "60", branchId: mainBranch.id },
    { name: "Vanilla Extract", category: "Flavoring", unit: "liters", currentQuantity: "2", minimumQuantity: "1", costPerUnit: "3500", branchId: mainBranch.id },
    { name: "Bread Bags", category: "Packaging", unit: "pcs", currentQuantity: "500", minimumQuantity: "100", costPerUnit: "25", branchId: mainBranch.id },
    { name: "All-Purpose Flour", category: "Flour", unit: "kg", currentQuantity: "180", minimumQuantity: "40", costPerUnit: "650", branchId: secondBranch.id },
    { name: "Active Dry Yeast", category: "Yeast", unit: "kg", currentQuantity: "3", minimumQuantity: "2", costPerUnit: "8500", branchId: secondBranch.id },
  ]);
  console.log("Inventory created");

  // Create production batches for the past week
  const now = new Date();
  for (let daysAgo = 6; daysAgo >= 0; daysAgo--) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    date.setHours(6, 30, 0, 0);

    const qty = 180 + Math.floor(Math.random() * 60);
    const waste = Math.floor(qty * 0.03 + Math.random() * 5);

    await db.insert(productionBatchesTable).values([
      {
        breadType: "Standard White Loaf",
        quantityProduced: qty,
        wasteQuantity: waste,
        staffId: productionUser.id,
        branchId: mainBranch.id,
        productionDate: date,
      },
      {
        breadType: "Agege Bread",
        quantityProduced: Math.floor(qty * 0.6),
        wasteQuantity: Math.floor(Math.random() * 4),
        staffId: productionUser.id,
        branchId: mainBranch.id,
        productionDate: new Date(date.getTime() + 3600000),
      },
    ]);
  }
  console.log("Production batches created");

  // Create sales for the past 2 weeks
  const breadPrices: Record<string, number> = {
    "Standard White Loaf": 800,
    "Agege Bread": 600,
    "Whole Wheat Loaf": 1000,
    "Sweet Bread": 500,
  };

  let receiptCounter = 1000;

  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const baseDate = new Date(now);
    baseDate.setDate(baseDate.getDate() - daysAgo);

    const salesPerDay = 8 + Math.floor(Math.random() * 10);

    for (let s = 0; s < salesPerDay; s++) {
      const saleDate = new Date(baseDate);
      saleDate.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);

      const breadTypes = Object.keys(breadPrices);
      const breadType = breadTypes[Math.floor(Math.random() * breadTypes.length)];
      const pricePerUnit = breadPrices[breadType];
      const quantity = 1 + Math.floor(Math.random() * 10);
      const totalAmount = pricePerUnit * quantity;
      const costAmount = pricePerUnit * 0.45 * quantity;
      const profitAmount = totalAmount - costAmount;
      const paymentMethod = Math.random() > 0.4 ? "cash" : "transfer";

      receiptCounter++;
      const receiptDate = `${saleDate.getFullYear()}${String(saleDate.getMonth() + 1).padStart(2, "0")}${String(saleDate.getDate()).padStart(2, "0")}`;
      const receiptNumber = `NMB-${receiptDate}-${String(receiptCounter).padStart(4, "0")}`;

      await db.insert(salesTable).values({
        receiptNumber,
        breadType,
        quantity,
        pricePerUnit: pricePerUnit.toString(),
        totalAmount: totalAmount.toString(),
        costAmount: costAmount.toString(),
        profitAmount: profitAmount.toString(),
        paymentMethod: paymentMethod as "cash" | "transfer",
        cashierId: receptionistUser.id,
        branchId: mainBranch.id,
        saleDate,
      });
    }
  }
  console.log("Sales created");

  console.log("\n=== SEED COMPLETE ===");
  console.log("Login credentials:");
  console.log("  Managing Director: admin / admin123");
  console.log("  Manager:           manager1 / manager123");
  console.log("  Receptionist:      receptionist1 / staff123");
  console.log("  Production Staff:  production1 / staff123");
  console.log("===================");
}

seed().catch(console.error).finally(() => process.exit(0));
