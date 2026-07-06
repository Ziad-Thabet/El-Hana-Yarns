import { useState, useRef, useEffect, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Plus,
  Search,
  Edit,
  Trash2,
  Barcode,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProductModel, UnitHelper } from "@/lib/domain";
import CategoryManagement from "@/features/categories/components/CategoryManagement";
import { productsApi } from "@/lib/api";
import {
  useProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
} from "@/features/products/hooks";
import { useCategories } from "@/lib/hooks";
import type { Product, UnitType } from "@/features/products/types";
import type { Category } from "@/lib/types";
import { FALLBACK_CATEGORY_COLOR } from "@/lib/config/category-colors";
import { PremiumButton, SuccessButton } from "@/components/ui/premium";
import { typography, images } from "@/lib/theme/styles";
import { strings } from "@/lib/i18n/ar";

interface ProductManagementProps {
  isAdmin: boolean;
}
const EMPTY_FORM = {
  name: "",
  price: "",
  pricePerKg: "",
  stock: "",
  barcode: "",
  category: "",
  unit: "piece" as UnitType,
  imageUrl: "",
};
const ProductManagement = ({ isAdmin }: ProductManagementProps) => {
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: categories = [], isLoading: loadingCats } = useCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();
  const loading = loadingProducts || loadingCats;
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const { toast } = useToast();
  const [generatingBarcode, setGeneratingBarcode] = useState(false);
  const generateBarcode = async () => {
    try {
      setGeneratingBarcode(true);
      const code = await productsApi.generateBarcode();
      setFormData((f) => ({ ...f, barcode: code }));
    } catch (err) {
      toast({
        title: strings.products.barcodeGenerateError,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setGeneratingBarcode(false);
    }
  };
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () =>
      setFormData((f) => ({ ...f, imageUrl: reader.result as string }));
    reader.readAsDataURL(file);
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const requiredPrice =
      formData.unit === "piece" ? formData.price : formData.pricePerKg;
    if (!formData.name || !requiredPrice) {
      toast({
        title: strings.common.dataError,
        description: strings.common.fillRequiredFields,
        variant: "destructive",
      });
      return;
    }
    const productData: Omit<Product, "id"> = {
      name: formData.name,
      price:
        formData.unit === "piece"
          ? parseFloat(formData.price)
          : parseFloat(formData.pricePerKg) || 0,
      stock: parseFloat(formData.stock) || 0,
      barcode: formData.barcode || undefined,
      category: formData.category || undefined,
      imageUrl: formData.imageUrl || undefined,
      unit: formData.unit,
      pricePerKg:
        formData.unit === "weight"
          ? parseFloat(formData.pricePerKg)
          : undefined,
    };
    try {
      setSaving(true);
      if (editingProduct) {
        const updated = await updateProduct.mutateAsync({
          id: editingProduct.id,
          data: productData,
        });
        toast({
          title: strings.products.updated,
          description: strings.products.updatedDesc.replace(
            "{name}",
            updated.name,
          ),
        });
      } else {
        const created = await createProduct.mutateAsync(productData);
        toast({
          title: strings.products.added,
          description: strings.products.addedDesc.replace(
            "{name}",
            created.name,
          ),
        });
      }
      closeDialog();
    } catch (err) {
      toast({
        title: strings.common.genericError,
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };
  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.unit === "piece" ? product.price.toString() : "",
      pricePerKg:
        product.unit === "weight"
          ? (product.pricePerKg ?? product.price).toString()
          : product.unit === "meter"
            ? product.price.toString()
            : "",
      stock: product.stock.toString(),
      barcode: product.barcode || "",
      category: product.category || "",
      unit: product.unit,
      imageUrl: product.imageUrl || "",
    });
    setIsDialogOpen(true);
  };
  const handleDelete = async (id: string) => {
    try {
      await deleteProduct.mutateAsync(id);
      toast({
        title: strings.products.deleted,
        description: strings.products.deletedDesc,
      });
    } catch (err) {
      toast({
        title: strings.common.deleteError,
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };
  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
  };
  const filteredProducts = useMemo(
    () => products.filter((p) => new ProductModel(p).matchesSearch(searchTerm)),
    [products, searchTerm],
  );
  const parentRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);
  useEffect(() => {
    if (!parentRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width < 768) setCols(1);
      else if (width < 1024) setCols(2);
      else if (width < 1280) setCols(3);
      else setCols(4);
    });
    obs.observe(parentRef.current);
    return () => obs.disconnect();
  }, []);
  const rowCount = Math.ceil(filteredProducts.length / cols);
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 420,
    overscan: 2,
    measureElement: (el) => el?.getBoundingClientRect().height ?? 420,
  });
  const getCategoryColor = (name: string) =>
    categories.find((c) => c.name === name)?.color ?? FALLBACK_CATEGORY_COLOR;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ms-3 text-muted-foreground">
          {strings.products.loading}
        </span>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-foreground">
          {strings.products.title}
        </h2>{" "}
        {isAdmin && (
          <Dialog
            open={isDialogOpen}
            onOpenChange={(open) => {
              if (!open) closeDialog();
              else setIsDialogOpen(true);
            }}
          >
            <DialogTrigger asChild>
              <PremiumButton
                onClick={() => {
                  setEditingProduct(null);
                  setFormData(EMPTY_FORM);
                }}
              >
                <Plus className="w-4 h-4 me-2" />
                {strings.products.addProduct}
              </PremiumButton>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct
                    ? strings.products.editProduct
                    : strings.products.addProduct}
                </DialogTitle>
                <p className="mt-2 text-sm text-muted-foreground">
                  {editingProduct
                    ? strings.products.editHint
                    : strings.products.addHint}
                </p>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">{strings.products.name} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder={strings.products.namePlaceholder}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="imageUpload">{strings.products.image}</Label>

                  <input
                    id="imageUpload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="block w-full rounded-xl border border-border bg-card/80 px-3 py-2 text-sm text-foreground file:me-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-2 file:text-foreground"
                  />
                  {formData.imageUrl && (
                    <img
                      src={formData.imageUrl}
                      alt={strings.products.imagePreview}
                      className={`mt-3 h-40 w-full rounded-xl border border-border ${images.productLg}`}
                    />
                  )}
                </div>
                <div>
                  <Label htmlFor="barcode">{strings.products.barcode}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="barcode"
                      value={formData.barcode}
                      onChange={(e) =>
                        setFormData({ ...formData, barcode: e.target.value })
                      }
                      placeholder={strings.products.barcode}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generateBarcode}
                      disabled={generatingBarcode}
                    >
                      {generatingBarcode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Barcode className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block">
                    {strings.products.productType}
                  </Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(v) =>
                      setFormData({ ...formData, unit: v as UnitType })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={strings.products.selectProductType}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piece">
                        {strings.products.typePiece}
                      </SelectItem>
                      <SelectItem value="weight">
                        {strings.products.typeWeight}
                      </SelectItem>
                      <SelectItem value="meter">
                        {strings.products.typeMeter}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.unit !== "piece" ? (
                  <>
                    <div>
                      <Label htmlFor="pricePerKg">
                        {formData.unit === "weight"
                          ? strings.products.pricePerKg
                          : strings.products.pricePerMeter}
                      </Label>
                      <Input
                        id="pricePerKg"
                        type="number"
                        step="0.01"
                        value={formData.pricePerKg}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            pricePerKg: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="stock">
                        {formData.unit === "weight"
                          ? strings.products.stockKg
                          : strings.products.stockMeter}
                      </Label>
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock}
                        onChange={(e) =>
                          setFormData({ ...formData, stock: e.target.value })
                        }
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label htmlFor="price">
                        {strings.products.unitPrice}
                      </Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({ ...formData, price: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="stock">
                        {strings.products.availableQty}
                      </Label>{" "}
                      <Input
                        id="stock"
                        type="number"
                        value={formData.stock}
                        onChange={(e) =>
                          setFormData({ ...formData, stock: e.target.value })
                        }
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label className="mb-2 block">
                    {strings.common.category}
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(v) =>
                      setFormData({ ...formData, category: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={strings.products.selectCategory}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 pt-4">
                  <SuccessButton type="submit" disabled={saving}>
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin me-2" />
                    ) : null}
                    {editingProduct
                      ? strings.common.update
                      : strings.common.add}
                  </SuccessButton>
                  <Button type="button" variant="outline" onClick={closeDialog}>
                    {strings.common.cancel}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>
      <CategoryManagement
        categories={categories}
        onCategoriesUpdate={() => {}}
        isAdmin={isAdmin}
      />
      <Card className="bg-card backdrop-blur-sm border border-border shadow-lg">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute start-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={strings.products.searchPlaceholder}
              className="ps-10"
            />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((product) => (
          <Card
            key={product.id}
            className="bg-secondary backdrop-blur-sm border border-border hover:shadow-lg transition-all duration-200"
          >
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className={images.productLg}
              />
            ) : (
              <div className="h-40 w-full rounded-t-lg bg-muted flex flex-col items-center justify-center gap-2">
                <div className="text-4xl">🧶</div>
                <span className="text-xs text-muted-foreground">
                  {strings.products.noImage}
                </span>
              </div>
            )}
            <CardHeader className="pb-3 pt-4 text-center">
              <div className="flex flex-col items-center gap-3">
                <CardTitle className="text-lg text-foreground">
                  {product.name}
                </CardTitle>
                {product.category && (
                  <Badge
                    variant="secondary"
                    className="text-xs text-foreground border-0"
                    style={{
                      backgroundColor: getCategoryColor(product.category),
                    }}
                  >
                    {product.category}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    {strings.products.unitPriceLabel}
                  </span>
                  <span className="font-bold text-sky-400 block">
                    {new ProductModel(product).priceLabel}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    {strings.products.stockLabel}
                  </span>
                  <Badge
                    variant={product.stock > 10 ? "default" : "destructive"}
                    className="justify-center"
                  >
                    {new ProductModel(product).stockLabel}
                  </Badge>
                </div>
              </div>
              {product.barcode && (
                <div className="text-center">
                  <span className="text-xs text-muted-foreground block mb-1">
                    {strings.products.barcode}
                  </span>
                  <span className="text-xs font-mono bg-muted text-muted-foreground px-2 py-1 rounded inline-block">
                    {product.barcode}
                  </span>
                </div>
              )}
              {isAdmin && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(product)}
                    className="flex-1"
                  >
                    <Edit className="w-3 h-3 me-1" />
                    {strings.common.edit}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(product.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {filteredProducts.length === 0 && !loading && (
        <Card className="bg-card backdrop-blur-sm border border-border shadow-lg">
          <CardContent className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">
              {strings.products.noProducts}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
export default ProductManagement;
