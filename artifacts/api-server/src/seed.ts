import crypto from "crypto";
import { db, companiesTable, subscriptionsTable, branchesTable, usersTable, inventoryItemsTable, productionBatchesTable, salesTable } from "@workspace/db";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

async function seed() {
  console.log("Starting seed...");

  const existingCompanies = await db.select().from(companiesTable).limit(1);
  if (existingCompanies.length > 0) {
    console.log("Database already seeded, skipping.");
    return;
  }

  // Create demo company
  const [company] = await db.insert(companiesTable).values({
    name: "New Model Bread",
    phone: "08012345678",
    themeColor: "amber",
    address: "12 Broad Street, Lagos Island, Lagos",
  }).returning();

  console.log("Company created:", company.name);

  // Create subscription (active for demo)
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  await db.insert(subscriptionsTable).values({
    companyId: company.id,
    plan: "starter",
    status: "active",
    priceMonthly: "3000",
    currentPeriodStart: now,
    currentPeriodEnd: periodEnd,
  });

  // Create branches
  const [mainBranch] = await db.insert(branchesTable).values({
    companyId: company.id,
    name: "Lagos Mainland",
    location: "12 Broad Street, Lagos Island, Lagos",
    isActive: true,
  }).returning();

  const [secondBranch] = await db.insert(branchesTable).values({
    companyId: company.id,
    name: "Ikeja Branch",
    location: "5 Allen Avenue, Ikeja, Lagos",
    isActive: true,
  }).returning();

  console.log("Branches created:", mainBranch.name, secondBranch.name);

  // Create users
  const users = await db.insert(usersTable).values([
    { companyId: company.id, username: "admin", passwordHash: hashPassword("admin123"), fullName: "Chukwuemeka Obi", role: "managing_director" as const, branchId: mainBranch.id, isActive: true },
    { companyId: company.id, username: "manager1", passwordHash: hashPassword("manager123"), fullName: "Adaeze Nwosu", role: "manager" as const, branchId: mainBranch.id, isActive: true },
    { companyId: company.id, username: "receptionist1", passwordHash: hashPassword("staff123"), fullName: "Fatima Bello", role: "receptionist" as const, branchId: mainBranch.id, isActive: true },
    { companyId: company.id, username: "production1", passwordHash: hashPassword("staff123"), fullName: "Kehinde Afolabi", role: "production_staff" as const, branchId: mainBranch.id, isActive: true },
    { companyId: company.id, username: "manager2", passwordHash: hashPassword("manager123"), fullName: "Emeka Eze", role: "manager" as const, branchId: secondBranch.id, isActive: true },
  ]).returning();

  console.log("Users created:", users.map(u => u.username).join(", "));

  const admin = users[0];
  const receptionist = users[2];
  const production = users[3];

  // Create inventory items
  const inventoryData = [
    { name: "Wheat Flour (50kg bag)", category: "Raw Material", unit: "bags", currentQuantity: "45", minimumQuantity: "10", costPerUnit: "22000", branchId: mainBranch.id },
    { name: "Yeast (500g)", category: "Raw Material", unit: "packs", currentQuantity: "8", minimumQuantity: "5", costPerUnit: "1500", branchId: mainBranch.id },
    { name: "Sugar (50kg bag)", category: "Raw Material", unit: "bags", currentQuantity: "3", minimumQuantity: "5", costPerUnit: "38000", branchId: mainBranch.id },
    { name: "Salt (1kg)", category: "Raw Material", unit: "packs", currentQuantity: "15", minimumQuantity: "8", costPerUnit: "300", branchId: mainBranch.id },
    { name: "Palm Oil (25L)", category: "Raw Material", unit: "gallons", currentQuantity: "2", minimumQuantity: "4", costPerUnit: "12000", branchId: mainBranch.id },
    { name: "Bread Improver", category: "Additive", unit: "kg", currentQuantity: "6", minimumQuantity: "2", costPerUnit: "2500", branchId: mainBranch.id },
    { name: "Bread Bags (pack of 100)", category: "Packaging", unit: "packs", currentQuantity: "4", minimumQuantity: "5", costPerUnit: "800", branchId: mainBranch.id },
    { name: "Wheat Flour (50kg bag)", category: "Raw Material", unit: "bags", currentQuantity: "20", minimumQuantity: "8", costPerUnit: "22000", branchId: secondBranch.id },
    { name: "Yeast (500g)", category: "Raw Material", unit: "packs", currentQuantity: "3", minimumQuantity: "4", costPerUnit: "1500", branchId: secondBranch.id },
    { name: "Sugar (50kg bag)", category: "Raw Material", unit: "bags", currentQuantity: "6", minimumQuantity: "4", costPerUnit: "38000", branchId: secondBranch.id },
    { name: "Salt (1kg)", category: "Raw Material", unit: "packs", currentQuantity: "10", minimumQuantity: "6", costPerUnit: "300", branchId: secondBranch.id },
  ];

  await db.insert(inventoryItemsTable).values(inventoryData.map(item => ({ companyId: company.id, ...item })));
  console.log("Inventory created:", inventoryData.length, "items");

  // Create production batches (last 7 days)
  const productionData = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(6, 0, 0, 0);
    productionData.push({ companyId: company.id, breadType: "Standard White Loaf", quantityProduced: Math.floor(Math.random() * 100) + 150, wasteQuantity: Math.floor(Math.random() * 10) + 2, staffId: production.id, branchId: mainBranch.id, productionDate: date });
    if (i % 2 === 0) {
      productionData.push({ companyId: company.id, breadType: "Agege Bread", quantityProduced: Math.floor(Math.random() * 60) + 80, wasteQuantity: Math.floor(Math.random() * 8) + 1, staffId: production.id, branchId: mainBranch.id, productionDate: new Date(date.getTime() + 2 * 60 * 60 * 1000) });
    }
  }
  await db.insert(productionBatchesTable).values(productionData);
  console.log("Production batches created:", productionData.length);

  // Create sales (last 14 days)
  const salesData = [];
  const breadTypes = ["Standard White Loaf", "Agege Bread", "Sweet Bread", "Whole Wheat Loaf"];
  const prices = [500, 400, 600, 700];
  let receiptCounter = 1;
  for (let i = 13; i >= 0; i--) {
    const numSales = Math.floor(Math.random() * 8) + 5;
    for (let j = 0; j < numSales; j++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(8 + j, Math.floor(Math.random() * 59), 0, 0);
      const typeIdx = Math.floor(Math.random() * breadTypes.length);
      const qty = Math.floor(Math.random() * 5) + 1;
      const price = prices[typeIdx];
      const total = qty * price;
      const dateStr = `${date.getFullYear()}${String(date.getMonth()+1).padStart(2,"0")}${String(date.getDate()).padStart(2,"0")}`;
      salesData.push({ companyId: company.id, receiptNumber: `NMB-${dateStr}-${String(receiptCounter++).padStart(4,"0")}`, breadType: breadTypes[typeIdx], quantity: qty, pricePerUnit: price.toString(), totalAmount: total.toString(), costAmount: "0", profitAmount: total.toString(), paymentMethod: Math.random() > 0.4 ? "cash" as const : "transfer" as const, cashierId: receptionist.id, branchId: mainBranch.id, saleDate: date });
    }
  }
  await db.insert(salesTable).values(salesData);
  console.log("Sales created:", salesData.length);

  console.log("\n✅ Seed complete!");
  console.log("Login credentials:");
  console.log("  admin / admin123 (Managing Director)");
  console.log("  manager1 / manager123 (Manager)");
  console.log("  receptionist1 / staff123 (Receptionist)");
  console.log("  production1 / staff123 (Production Staff)");
}

seed().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
