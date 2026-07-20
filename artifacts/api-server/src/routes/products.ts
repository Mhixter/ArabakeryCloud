import { Router, IRouter } from "express";
import { db, productsTable } from "@workspace/db";
import { eq, and, or, isNull } from "drizzle-orm";
import { authenticate, requireRole, AuthenticatedRequest } from "../middlewares/authMiddleware";
import { logAudit } from "../lib/audit";

const router: IRouter = Router();

const formatProduct = (p: typeof productsTable.$inferSelect) => ({
  id: p.id,
  companyId: p.companyId,
  branchId: p.branchId ?? null,
  name: p.name,
  description: p.description ?? null,
  pricePerUnit: parseFloat(p.pricePerUnit as unknown as string),
  unit: p.unit,
  isActive: p.isActive,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

/* LIST — scoped to the active branch; accepts ?branchId query param for MDs switching branches */
router.get("/products", authenticate, async (req: AuthenticatedRequest, res): Promise<void> => {
  const { companyId, branchId: jwtBranchId } = req.user!;
  const { branchId: queryBranchId } = req.query as { branchId?: string };

  const effectiveBranchId = queryBranchId ? parseInt(queryBranchId) : (jwtBranchId ?? null);

  const products = await db
    .select()
    .from(productsTable)
    .where(
      effectiveBranchId
        /* Include products tied to this branch AND company-wide products (branchId IS NULL)
           so that products added by the MD without a branch always appear everywhere. */
        ? and(eq(productsTable.companyId, companyId), or(eq(productsTable.branchId, effectiveBranchId), isNull(productsTable.branchId)))
        : eq(productsTable.companyId, companyId),
    )
    .orderBy(productsTable.name);

  res.json(products.map(formatProduct));
});

/* CREATE — managing_director or manager only */
router.post("/products", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId, branchId: jwtBranchId } = req.user!;
    const { name, description, pricePerUnit, unit, branchId: bodyBranchId } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ error: "Product name is required" });
      return;
    }

    /* Prefer branchId from the request body (sent by the frontend for the active branch),
       falling back to the JWT branchId for backwards compatibility */
    const effectiveBranchId = bodyBranchId != null ? Number(bodyBranchId) || null : (jwtBranchId ?? null);

    const [product] = await db.insert(productsTable).values({
      companyId,
      branchId: effectiveBranchId,
      name: name.trim(),
      description: description?.trim() || null,
      pricePerUnit: (parseFloat(pricePerUnit) || 0).toFixed(2),
      unit: unit?.trim() || "loaf",
      isActive: true,
    }).returning();

    await logAudit({
      req,
      userId: req.user!.userId,
      companyId,
      action: "PRODUCT_CREATED",
      entityType: "product",
      entityId: product.id,
      details: `Created product: ${product.name}${effectiveBranchId ? ` (branch ${effectiveBranchId})` : ""}`,
    });

    res.status(201).json(formatProduct(product));
  } catch (err) {
    console.error("POST /products error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

/* UPDATE — managing_director or manager only */
router.patch("/products/:id", authenticate, requireRole("managing_director", "manager"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId, branchId, role } = req.user!;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const { name, description, pricePerUnit, unit, isActive } = req.body;

    const updates: Partial<typeof productsTable.$inferInsert> = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (pricePerUnit !== undefined) updates.pricePerUnit = (parseFloat(pricePerUnit) || 0).toFixed(2) as unknown as string;
    if (unit !== undefined) updates.unit = unit.trim();
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    /* MDs can edit any product in their company; managers are restricted to their branch */
    const ownerFilter = (role === "managing_director" || !branchId)
      ? and(eq(productsTable.id, id), eq(productsTable.companyId, companyId))
      : and(eq(productsTable.id, id), eq(productsTable.companyId, companyId), eq(productsTable.branchId, branchId));

    const [existing] = await db.select().from(productsTable).where(ownerFilter);
    if (!existing) { res.status(404).json({ error: "Product not found" }); return; }

    const [updated] = await db.update(productsTable).set(updates).where(ownerFilter).returning();

    await logAudit({
      req,
      userId: req.user!.userId,
      companyId,
      action: "PRODUCT_UPDATED",
      entityType: "product",
      entityId: id,
      details: `Updated product: ${updated.name}`,
    });

    res.json(formatProduct(updated));
  } catch (err) {
    console.error("PATCH /products/:id error:", err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

/* DELETE — managing_director only */
router.delete("/products/:id", authenticate, requireRole("managing_director"), async (req: AuthenticatedRequest, res): Promise<void> => {
  try {
    const { companyId } = req.user!;
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

    /* MDs can delete any product in their company */
    const ownerFilter = and(eq(productsTable.id, id), eq(productsTable.companyId, companyId));

    const [existing] = await db.select().from(productsTable).where(ownerFilter);
    if (!existing) { res.status(404).json({ error: "Product not found" }); return; }

    await db.delete(productsTable).where(ownerFilter);

    await logAudit({
      req,
      userId: req.user!.userId,
      companyId,
      action: "PRODUCT_DELETED",
      entityType: "product",
      entityId: id,
      details: `Deleted product: ${existing.name}`,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /products/:id error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

export default router;
