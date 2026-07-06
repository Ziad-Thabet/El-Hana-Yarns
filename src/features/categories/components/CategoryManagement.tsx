import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Tag, Package, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/features/categories/hooks";
import type { Category } from "@/features/categories/types";
import {
  CATEGORY_COLOR_PRESETS,
  DEFAULT_CATEGORY_COLOR,
} from "@/lib/config/category-colors";
import { SuccessButton } from "@/components/ui/premium";
import { strings } from "@/lib/i18n/ar";
interface CategoryManagementProps {
  categories: Category[];
  onCategoriesUpdate?: (categories: Category[]) => void;
  isAdmin: boolean;
}

const EMPTY_FORM = {
  name: "",
  description: "",
  color: DEFAULT_CATEGORY_COLOR as string,
};

const CategoryManagement = ({
  categories,
  onCategoriesUpdate,
  isAdmin,
}: CategoryManagementProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
      toast({
        title: strings.common.enterCategoryName,
        variant: "destructive",
      });
      return;
    }
    try {
      setSaving(true);
      if (editingCategory) {
        const updated = await updateCategory.mutateAsync({
          id: editingCategory.id,
          data: formData as Partial<Category>,
        });
        toast({
          title: strings.categories.updated,
          description: `${updated.name}`,
        });
      } else {
        const created = await createCategory.mutateAsync(
          formData as Omit<Category, "id">,
        );
        toast({
          title: strings.categories.added,
          description: `${created.name}`,
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

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory.mutateAsync(id);
      toast({ title: strings.categories.deleted });
    } catch (err) {
      toast({
        title: strings.common.deleteError,
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description ?? "",
      color: category.color,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    setFormData(EMPTY_FORM);
  };

  return (
    <Card className="bg-card backdrop-blur-sm border border-border shadow-lg">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Tag className="w-5 h-5" />
            {strings.categories.title}
          </CardTitle>
          {isAdmin && (
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                if (!open) closeDialog();
                else setIsDialogOpen(true);
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingCategory(null);
                    setFormData(EMPTY_FORM);
                  }}
                >
                  <Plus className="w-4 h-4 me-2" />
                  {strings.categories.addCategory}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md bg-card text-foreground">
                <DialogHeader>
                  <DialogTitle className="text-foreground">
                    {editingCategory
                      ? strings.categories.editCategory
                      : strings.categories.addNewCategory}
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label>{strings.categories.name} *</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder={strings.categories.namePlaceholder}
                      className="bg-secondary text-foreground border-border placeholder:text-muted-foreground"
                      required
                    />
                  </div>
                  <div>
                    <Label>{strings.categories.description}</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          description: e.target.value,
                        })
                      }
                      placeholder={strings.categories.descriptionPlaceholder}
                      className="bg-secondary text-foreground border-border placeholder:text-muted-foreground"
                    />
                  </div>
                  <div>
                    <Label>{strings.categories.color}</Label>
                    <Input
                      type="color"
                      value={formData.color}
                      onChange={(e) =>
                        setFormData({ ...formData, color: e.target.value })
                      }
                      className="h-12 p-1 cursor-pointer"
                    />
                  </div>
                  <div className="flex gap-2 pt-4">
                    <SuccessButton
                      type="submit"
                      disabled={saving}
                      className="flex-1"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin me-2" />
                      ) : null}
                      {editingCategory
                        ? strings.common.update
                        : strings.common.add}
                    </SuccessButton>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeDialog}
                    >
                      {strings.common.cancel}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-foreground">{strings.categories.noCategories}</p>
            <p className="text-sm mt-2">
              {strings.categories.noCategoriesHint}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="p-3 bg-secondary rounded-xl border border-border flex items-center justify-between group hover:shadow-lg transition-all duration-200"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  />
                  <div className="min-w-0">
                    <span className="font-medium text-sm text-foreground block truncate">
                      {category.name}
                    </span>
                    {category.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {category.description}
                      </p>
                    )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(category)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(category.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CategoryManagement;
