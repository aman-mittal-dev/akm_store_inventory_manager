import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useInventory } from '../context/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ArrowLeft, Save, Plus, Trash2, Package, Loader2, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import { BundleItem } from '../types';
import { uploadItemImageApi } from '../services/inventoryService';
import { humanizeApiError } from '../utils/apiErrors';

export function AddEditItem() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, addItem, updateItem, getItemById } = useInventory();
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    purchasePrice: '',
    sellingPrice: '',
    currentStock: '',
    lowStockThreshold: '',
    imageUrl: '',
    description: '',
    isBundle: false,
  });

  const [bundleItems, setBundleItems] = useState<BundleItem[]>([]);
  const [currentBundleItem, setCurrentBundleItem] = useState({
    itemId: '',
    quantity: '',
  });
  const [imageUploading, setImageUploading] = useState(false);

  useEffect(() => {
    if (isEditMode && id) {
      const item = getItemById(id);
      if (item) {
        setFormData({
          name: item.name,
          sku: item.sku,
          category: item.category,
          purchasePrice: item.purchasePrice.toString(),
          sellingPrice: item.sellingPrice.toString(),
          currentStock: item.currentStock.toString(),
          lowStockThreshold: item.lowStockThreshold.toString(),
          imageUrl: item.imageUrl || '',
          description: item.description || '',
          isBundle: item.isBundle || false,
        });
        if (item.bundleItems) {
          setBundleItems(item.bundleItems);
        }
      }
    }
  }, [id, isEditMode, getItemById]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setImageUploading(true);
      const url = await uploadItemImageApi(file);
      setFormData((prev) => ({ ...prev, imageUrl: url }));
      toast.success('Image uploaded and attached to this item.');
    } catch (err) {
      toast.error(humanizeApiError(err, 'Could not upload image.'));
    } finally {
      setImageUploading(false);
    }
  };

  const handleBundleItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCurrentBundleItem((prev) => ({ ...prev, [name]: value }));
  };

  const addBundleItem = () => {
    if (!currentBundleItem.itemId || !currentBundleItem.quantity) {
      toast.error('Please select an item and enter a quantity');
      return;
    }

    const item = items.find(i => i.id === currentBundleItem.itemId);
    if (!item) {
      toast.error('Selected item not found');
      return;
    }

    const quantity = parseInt(currentBundleItem.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const existingItemIndex = bundleItems.findIndex(bi => bi.itemId === currentBundleItem.itemId);
    if (existingItemIndex !== -1) {
      const updatedBundleItems = [...bundleItems];
      updatedBundleItems[existingItemIndex].quantity = quantity;
      setBundleItems(updatedBundleItems);
    } else {
      setBundleItems(prev => [...prev, { ...currentBundleItem, quantity }]);
    }

    setCurrentBundleItem({ itemId: '', quantity: '' });
  };

  const addCurrentItemAsBundleComponent = () => {
    if (!isEditMode || !id) {
      toast.error('Please save this item first, then edit to use it as a bundle component');
      return;
    }

    const existingItemIndex = bundleItems.findIndex((bi) => bi.itemId === id);
    if (existingItemIndex !== -1) {
      toast.info('This item is already added in bundle components');
      return;
    }

    setBundleItems((prev) => [...prev, { itemId: id, quantity: 1 }]);
    toast.success('Current item added as bundle component');
  };

  const removeBundleItem = (itemId: string) => {
    setBundleItems(prev => prev.filter(bi => bi.itemId !== itemId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.name || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (isEditMode && !formData.sku.trim()) {
      toast.error('SKU is required when editing');
      return;
    }

    const purchasePrice = parseFloat(formData.purchasePrice);
    const sellingPrice = parseFloat(formData.sellingPrice);
    const currentStock = parseInt(formData.currentStock);
    const lowStockThreshold = parseInt(formData.lowStockThreshold);

    if (isNaN(purchasePrice) || isNaN(sellingPrice) || isNaN(currentStock) || isNaN(lowStockThreshold)) {
      toast.error('Please enter valid numbers for prices and stock');
      return;
    }

    if (purchasePrice < 0 || sellingPrice < 0 || currentStock < 0 || lowStockThreshold < 0) {
      toast.error('Values cannot be negative');
      return;
    }

    const itemData = {
      name: formData.name,
      category: formData.category,
      purchasePrice,
      sellingPrice,
      currentStock,
      lowStockThreshold,
      imageUrl: formData.imageUrl || undefined,
      description: formData.description || undefined,
      isBundle: formData.isBundle,
      bundleItems: formData.isBundle ? bundleItems : undefined,
    };

    try {
      if (isEditMode && id) {
        await updateItem(id, { ...itemData, sku: formData.sku.trim() });
      } else {
        await addItem(itemData);
      }
      navigate('/inventory');
    } catch {
      // InventoryContext already showed an error toast
    }
  };

  const profitMargin = formData.purchasePrice && formData.sellingPrice
    ? ((parseFloat(formData.sellingPrice) - parseFloat(formData.purchasePrice)) / parseFloat(formData.sellingPrice) * 100).toFixed(1)
    : '0';

  const profitPerUnit = formData.purchasePrice && formData.sellingPrice
    ? (parseFloat(formData.sellingPrice) - parseFloat(formData.purchasePrice)).toFixed(2)
    : '0';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/inventory')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <div>
          <h2 className="text-3xl font-semibold text-gray-900">
            {isEditMode ? 'Edit Item' : 'Add New Item'}
          </h2>
          <p className="text-gray-600 mt-2">
            {isEditMode ? 'Update item details and pricing' : 'Add a new item to your inventory'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Item Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className={`space-y-2 ${!isEditMode ? 'md:col-span-2' : ''}`}>
                <Label htmlFor="name">Item Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Wireless Mouse"
                  required
                />
              </div>

              {isEditMode && (
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU *</Label>
                  <Input
                    id="sku"
                    name="sku"
                    value={formData.sku}
                    onChange={handleChange}
                    placeholder="e.g., WM-001"
                    required
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                name="category"
                value={formData.category}
                onChange={handleChange}
                placeholder="e.g., Electronics"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Enter item description..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="itemImage">Item image</Label>
              <p className="text-xs text-gray-500 mb-2">
                JPEG, PNG, or WebP — max 5 MB. Images are stored on Amazon S3 when the server is configured.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor="itemImage"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
                >
                  {imageUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {imageUploading ? 'Uploading…' : 'Choose file'}
                  <input
                    id="itemImage"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    disabled={imageUploading}
                    onChange={handleImageFile}
                  />
                </label>
                {formData.imageUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                  >
                    Remove image
                  </Button>
                )}
              </div>
              {formData.imageUrl && (
                <div className="mt-2">
                  <img
                    src={formData.imageUrl}
                    alt="Preview"
                    className="h-32 w-32 rounded-md border border-gray-200 object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Pricing & Financial Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Purchase Price (INR) *</Label>
                <Input
                  id="purchasePrice"
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sellingPrice">Selling Price (INR) *</Label>
                <Input
                  id="sellingPrice"
                  name="sellingPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sellingPrice}
                  onChange={handleChange}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {/* Profit Calculation Display */}
            {formData.purchasePrice && formData.sellingPrice && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Profit per Unit:</span>
                  <span className="text-sm font-semibold text-green-600">
                    ₹{profitPerUnit}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-700">Profit Margin:</span>
                  <span className="text-sm font-semibold text-green-600">
                    {profitMargin}%
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Stock Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentStock">Current Stock *</Label>
                <Input
                  id="currentStock"
                  name="currentStock"
                  type="number"
                  min="0"
                  value={formData.currentStock}
                  onChange={handleChange}
                  placeholder="0"
                  required
                />
                <p className="text-sm text-gray-500">Number of units in stock</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lowStockThreshold">Low Stock Threshold *</Label>
                <Input
                  id="lowStockThreshold"
                  name="lowStockThreshold"
                  type="number"
                  min="0"
                  value={formData.lowStockThreshold}
                  onChange={handleChange}
                  placeholder="10"
                  required
                />
                <p className="text-sm text-gray-500">Alert when stock falls to this level</p>
              </div>
            </div>

            {/* Stock Status Preview */}
            {formData.currentStock && formData.lowStockThreshold && (
              parseInt(formData.currentStock) <= parseInt(formData.lowStockThreshold) && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800 flex items-center gap-2">
                    <span className="font-semibold">⚠️ Low Stock Warning:</span>
                    Current stock is at or below the threshold
                  </p>
                </div>
              )
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Bundle Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="isBundle">Is Bundle</Label>
              <Input
                id="isBundle"
                name="isBundle"
                type="checkbox"
                checked={formData.isBundle}
                onChange={e => setFormData(prev => ({ ...prev, isBundle: e.target.checked }))}
              />
            </div>

            {formData.isBundle && (
              <div className="space-y-4">
                {items.length === 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      No inventory items found yet. Save this item first, then open Edit Item to add bundle components.
                    </p>
                  </div>
                )}

                {!isEditMode && items.length > 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      You can create this as a bundle now. If you want this same item as a component, save first and then edit it.
                    </p>
                  </div>
                )}

                {isEditMode && id && (
                  <Button type="button" onClick={addCurrentItemAsBundleComponent} variant="outline">
                    <Package className="w-4 h-4 mr-2" />
                    Add This Item Itself (Qty 1)
                  </Button>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="itemId">Select Item</Label>
                    <Select
                      value={currentBundleItem.itemId}
                      onValueChange={value => setCurrentBundleItem(prev => ({ ...prev, itemId: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map(item => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} ({item.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="1"
                      value={currentBundleItem.quantity}
                      onChange={handleBundleItemChange}
                      placeholder="1"
                      required
                    />
                  </div>
                </div>

                <Button type="button" onClick={addBundleItem} className="bg-green-600 hover:bg-green-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item to Bundle
                </Button>

                {bundleItems.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-900">Bundle Items</h3>
                    <div className="space-y-2">
                      {bundleItems.map(bi => (
                        <div key={bi.itemId} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-700">
                              {items.find(i => i.id === bi.itemId)?.name} ({items.find(i => i.id === bi.itemId)?.sku})
                            </p>
                            <p className="text-xs text-gray-500">Quantity: {bi.quantity}</p>
                          </div>
                          <Button type="button" onClick={() => removeBundleItem(bi.itemId)} className="bg-red-600 hover:bg-red-700">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4 mt-6">
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {isEditMode ? 'Update Item' : 'Add Item'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate('/inventory')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}