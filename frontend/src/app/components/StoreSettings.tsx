import { useState } from 'react';
import { useInventory } from '../context/InventoryContext';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Store, Save, X } from 'lucide-react';
import { toast } from 'sonner';

export function StoreSettings() {
  const { storeSettings, updateStoreSettings } = useInventory();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(storeSettings);

  const handleSave = () => {
    updateStoreSettings(formData);
    setIsEditing(false);
    toast.success('Store settings updated successfully!');
  };

  const handleCancel = () => {
    setFormData(storeSettings);
    setIsEditing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-semibold text-gray-900">Store Settings</h2>
          <p className="text-gray-600 mt-2">Manage your store information and details</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>
            <Store className="w-4 h-4 mr-2" />
            Edit Settings
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={handleSave}>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Store Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="storeName">Store Name *</Label>
              <Input
                id="storeName"
                value={formData.storeName}
                onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                disabled={!isEditing}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="gstNumber">GST Number *</Label>
              <Input
                id="gstNumber"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                disabled={!isEditing}
                className="mt-1"
                placeholder="29XXXXX1234X1ZX"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address *</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              disabled={!isEditing}
              className="mt-1"
              rows={3}
              placeholder="Enter complete store address"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                disabled={!isEditing}
                className="mt-1"
                placeholder="+91 9876543210"
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={!isEditing}
                className="mt-1"
                placeholder="store@example.com"
              />
            </div>
          </div>

          {!isEditing && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This information will appear on all your invoices and bills.
                Make sure to keep it updated and accurate.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-6 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900">{formData.storeName}</h3>
              <p className="text-gray-600 mt-1">{formData.address}</p>
              <div className="flex items-center justify-center gap-4 mt-2 text-sm text-gray-600">
                <span>GST: {formData.gstNumber}</span>
                <span>•</span>
                <span>{formData.phone}</span>
                {formData.email && (
                  <>
                    <span>•</span>
                    <span>{formData.email}</span>
                  </>
                )}
              </div>
            </div>
            <div className="border-t border-gray-300 pt-4">
              <p className="text-center text-gray-500 text-sm">
                This is how your store information will appear on invoices
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
