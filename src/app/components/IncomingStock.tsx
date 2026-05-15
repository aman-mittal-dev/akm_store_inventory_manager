import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useInventory } from "../context/InventoryContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  ArrowDownToLine,
  FileText,
  Plus,
  Trash2,
  ShoppingCart,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import {
  formatINR,
  generateBillNumber,
} from "../utils/currency";
import { TransactionItem } from "../types";
import { normalizePartyKey, roundMoney } from "../utils/party";
import { payableOutstandingForPartyKey } from "../utils/partySummaries";
import { generateAdHocSku } from "../utils/sku";
import { Checkbox } from "./ui/checkbox";

interface CartItem extends TransactionItem {
  purchasePrice: number;
}

export function IncomingStock() {
  const navigate = useNavigate();
  const { items, addIncomingTransaction, incomingTransactions } =
    useInventory();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [supplierInfo, setSupplierInfo] = useState({
    supplierName: "",
    supplierContact: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    paidAmount: "",
    paymentMethod: "cash",
  });

  const [currentItem, setCurrentItem] = useState({
    itemId: "",
    quantity: "",
    purchasePrice: "",
  });

  const [isCustomItem, setIsCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemPrice, setCustomItemPrice] = useState("");
  const [customItemQuantity, setCustomItemQuantity] =
    useState("");

  const [includePreviousOutstanding, setIncludePreviousOutstanding] =
    useState(false);
  const [carryAmountStr, setCarryAmountStr] = useState("");

  const partyKeyPreview = useMemo(() => {
    if (!supplierInfo.supplierName.trim()) return null;
    return normalizePartyKey(supplierInfo.supplierName, supplierInfo.supplierContact);
  }, [supplierInfo.supplierName, supplierInfo.supplierContact]);

  const priorOutstanding = useMemo(() => {
    if (!partyKeyPreview) return 0;
    return payableOutstandingForPartyKey(incomingTransactions, partyKeyPreview);
  }, [incomingTransactions, partyKeyPreview]);

  useEffect(() => {
    setIncludePreviousOutstanding(false);
    setCarryAmountStr("");
  }, [partyKeyPreview]);

  useEffect(() => {
    if (includePreviousOutstanding && priorOutstanding > 0) {
      setCarryAmountStr(String(roundMoney(priorOutstanding)));
    }
  }, [includePreviousOutstanding, priorOutstanding]);

  const selectedItem = items.find(
    (item) => item.id === currentItem.itemId,
  );

  const handleAddToCart = () => {
    if (isCustomItem) {
      // Add custom item
      if (
        !customItemName.trim() ||
        !customItemQuantity ||
        !customItemPrice
      ) {
        toast.error("Please fill in all custom item fields");
        return;
      }

      const quantity = parseInt(customItemQuantity);
      const purchasePrice = parseFloat(customItemPrice);

      if (
        isNaN(quantity) ||
        isNaN(purchasePrice) ||
        quantity <= 0 ||
        purchasePrice < 0
      ) {
        toast.error("Please enter valid values");
        return;
      }

      const cartItem: CartItem = {
        itemId: `custom-${Date.now()}`,
        itemName: customItemName.trim(),
        sku: generateAdHocSku(),
        quantity,
        pricePerUnit: purchasePrice,
        totalPrice: quantity * purchasePrice,
        purchasePrice,
      };

      setCart([...cart, cartItem]);
      setCustomItemName("");
      setCustomItemPrice("");
      setCustomItemQuantity("");
      toast.success(`Added ${customItemName} to cart`);
    } else {
      // Add from inventory
      if (
        !currentItem.itemId ||
        !currentItem.quantity ||
        !currentItem.purchasePrice
      ) {
        toast.error(
          "Please select item and fill in all fields",
        );
        return;
      }

      const quantity = parseInt(currentItem.quantity);
      const purchasePrice = parseFloat(
        currentItem.purchasePrice,
      );

      if (
        isNaN(quantity) ||
        isNaN(purchasePrice) ||
        quantity <= 0 ||
        purchasePrice < 0
      ) {
        toast.error("Please enter valid values");
        return;
      }

      const item = items.find(
        (i) => i.id === currentItem.itemId,
      );
      if (!item) {
        toast.error("Item not found");
        return;
      }

      // Check if bundle item - if yes, expand to show contained items
      const cartItem: CartItem = {
        itemId: item.id,
        itemName: item.name,
        sku: item.sku,
        quantity,
        pricePerUnit: purchasePrice,
        totalPrice: quantity * purchasePrice,
        purchasePrice,
      };

      setCart([...cart, cartItem]);
      setCurrentItem({
        itemId: "",
        quantity: "",
        purchasePrice: "",
      });
      toast.success(`Added ${item.name} to cart`);
    }
  };

  const handleRemoveFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
    toast.success("Item removed from cart");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (cart.length === 0) {
      toast.error("Please add at least one item to the cart");
      return;
    }

    if (!supplierInfo.supplierName) {
      toast.error("Please enter supplier name");
      return;
    }

    const linesSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

    let previousCarried = includePreviousOutstanding
      ? roundMoney(parseFloat(carryAmountStr) || 0)
      : 0;
    if (!includePreviousOutstanding) previousCarried = 0;
    const maxPrior = roundMoney(priorOutstanding);
    if (includePreviousOutstanding && maxPrior <= 0) {
      toast.error(
        "There is no pending amount owed to this supplier on record",
      );
      return;
    }
    if (previousCarried < 0) {
      toast.error("Amount cannot be negative");
      return;
    }
    if (previousCarried > maxPrior) {
      toast.error(
        `Added prior balance cannot exceed ${formatINR(maxPrior)}`,
      );
      return;
    }

    const totalCost = roundMoney(linesSubtotal + previousCarried);
    const billNumber = generateBillNumber();
    const paidAmount = parseFloat(supplierInfo.paidAmount) || 0;
    const pendingAmount = roundMoney(totalCost - paidAmount);
    const paymentStatus: "paid" | "partial" | "unpaid" =
      paidAmount === 0
        ? "unpaid"
        : paidAmount >= totalCost
          ? "paid"
          : "partial";

    // Process bundle items - expand them to update contained items
    const processedItems: TransactionItem[] = [];

    cart.forEach((cartItem) => {
      const item = items.find((i) => i.id === cartItem.itemId);

      // Add the main item
      processedItems.push({
        itemId: cartItem.itemId,
        itemName: cartItem.itemName,
        sku: cartItem.sku,
        quantity: cartItem.quantity,
        pricePerUnit: cartItem.pricePerUnit,
        totalPrice: cartItem.totalPrice,
      });

      // If it's a bundle, also update the contained items' stock
      if (item?.isBundle && item.bundleItems) {
        item.bundleItems.forEach((bundleItem) => {
          const containedItem = items.find(
            (i) => i.id === bundleItem.itemId,
          );
          if (containedItem) {
            // Update stock for contained items without charging
            const totalContainedQty =
              bundleItem.quantity * cartItem.quantity;
            processedItems.push({
              itemId: containedItem.id,
              itemName: `${containedItem.name} (from bundle)`,
              sku: containedItem.sku,
              quantity: totalContainedQty,
              pricePerUnit: 0, // No separate cost - included in bundle price
              totalPrice: 0,
            });
          }
        });
      }
    });

    addIncomingTransaction({
      items: processedItems,
      totalCost,
      previousOutstandingCarried: previousCarried || undefined,
      supplierName: supplierInfo.supplierName,
      supplierContact:
        supplierInfo.supplierContact || undefined,
      date: new Date(supplierInfo.date).toISOString(),
      notes: supplierInfo.notes || undefined,
      billNumber,
      paidAmount,
      pendingAmount,
      paymentStatus,
      paymentHistory:
        paidAmount > 0
          ? [
              {
                id: "1",
                amount: paidAmount,
                date: new Date().toISOString(),
                method: supplierInfo.paymentMethod,
                notes: "Initial payment",
              },
            ]
          : undefined,
    });

    const totalItems = cart.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
    toast.success(
      `Purchase recorded successfully! Bill #${billNumber}`,
    );
    navigate(`/bill/${billNumber}`);
  };

  const linesSubtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
  let carryParsed = includePreviousOutstanding
    ? parseFloat(carryAmountStr)
    : 0;
  carryParsed = Number.isFinite(carryParsed) ? roundMoney(carryParsed) : 0;
  const cappedCarry = includePreviousOutstanding
    ? roundMoney(
        Math.min(
          Math.max(carryParsed, 0),
          roundMoney(priorOutstanding),
        ),
      )
    : 0;
  const invoiceGrandTotal = roundMoney(linesSubtotal + cappedCarry);
  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <ArrowDownToLine className="w-8 h-8 text-green-600" />
          <h2 className="text-3xl font-semibold text-gray-900">
            Purchase Stock
          </h2>
        </div>
        <p className="text-gray-600">
          Add multiple items to purchase in a single transaction
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Add Items to Cart */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Add Items to Purchase
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button
                  type="button"
                  variant={
                    !isCustomItem ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setIsCustomItem(false)}
                  className="flex-1"
                >
                  From Inventory
                </Button>
                <Button
                  type="button"
                  variant={isCustomItem ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsCustomItem(true)}
                  className="flex-1"
                >
                  Custom Item
                </Button>
              </div>

              {!isCustomItem ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="itemId">Select Item</Label>
                    <Select
                      value={currentItem.itemId}
                      onValueChange={(value) => {
                        const item = items.find(
                          (i) => i.id === value,
                        );
                        setCurrentItem((prev) => ({
                          ...prev,
                          itemId: value,
                          purchasePrice:
                            item?.purchasePrice.toString() ||
                            "",
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((item) => (
                          <SelectItem
                            key={item.id}
                            value={item.id}
                          >
                            <div className="flex items-center gap-2">
                              {item.isBundle && (
                                <Package className="w-4 h-4 text-purple-600" />
                              )}
                              {item.name} ({item.sku})
                              {item.isBundle && " - BUNDLE"}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedItem && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-4">
                        {selectedItem.imageUrl && (
                          <img
                            src={selectedItem.imageUrl}
                            alt={selectedItem.name}
                            className="w-16 h-16 object-cover rounded-md"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium text-gray-900">
                              {selectedItem.name}
                            </h4>
                            {selectedItem.isBundle && (
                              <span className="text-xs bg-purple-600 text-white px-2 py-1 rounded">
                                BUNDLE
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            Current Stock:{" "}
                            {selectedItem.currentStock} units
                          </p>
                          {selectedItem.isBundle &&
                            selectedItem.bundleItems && (
                              <div className="mt-2 pt-2 border-t border-blue-300">
                                <p className="text-xs font-semibold text-gray-700 mb-1">
                                  Contains:
                                </p>
                                {selectedItem.bundleItems.map(
                                  (bundleItem) => {
                                    const containedItem =
                                      items.find(
                                        (i) =>
                                          i.id ===
                                          bundleItem.itemId,
                                      );
                                    return containedItem ? (
                                      <p
                                        key={bundleItem.itemId}
                                        className="text-xs text-gray-600"
                                      >
                                        • {bundleItem.quantity}x{" "}
                                        {containedItem.name}
                                      </p>
                                    ) : null;
                                  },
                                )}
                              </div>
                            )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
                      <Input
                        id="quantity"
                        type="number"
                        min="1"
                        value={currentItem.quantity}
                        onChange={(e) =>
                          setCurrentItem((prev) => ({
                            ...prev,
                            quantity: e.target.value,
                          }))
                        }
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="purchasePrice">
                        Purchase Price (INR/unit)
                      </Label>
                      <Input
                        id="purchasePrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={currentItem.purchasePrice}
                        onChange={(e) =>
                          setCurrentItem((prev) => ({
                            ...prev,
                            purchasePrice: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="customItemName">
                      Item Name *
                    </Label>
                    <Input
                      id="customItemName"
                      value={customItemName}
                      onChange={(e) =>
                        setCustomItemName(e.target.value)
                      }
                      placeholder="Enter item name"
                    />
                    <p className="text-xs text-gray-500">
                      A unique line code is generated for this row automatically.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customItemQuantity">
                        Quantity *
                      </Label>
                      <Input
                        id="customItemQuantity"
                        type="number"
                        min="1"
                        value={customItemQuantity}
                        onChange={(e) =>
                          setCustomItemQuantity(e.target.value)
                        }
                        placeholder="0"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="customItemPrice">
                        Purchase Price (INR/unit) *
                      </Label>
                      <Input
                        id="customItemPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        value={customItemPrice}
                        onChange={(e) =>
                          setCustomItemPrice(e.target.value)
                        }
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      <strong>Note:</strong> Custom items won't
                      be tracked in your inventory system. They
                      will only appear on this bill.
                    </p>
                  </div>
                </div>
              )}

              <Button
                type="button"
                onClick={handleAddToCart}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add to Cart
              </Button>
            </CardContent>
          </Card>

          {/* Supplier Information */}
          <Card>
            <CardHeader>
              <CardTitle>Supplier Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="supplierName">
                  Supplier Name *
                </Label>
                <Input
                  id="supplierName"
                  value={supplierInfo.supplierName}
                  onChange={(e) =>
                    setSupplierInfo((prev) => ({
                      ...prev,
                      supplierName: e.target.value,
                    }))
                  }
                  placeholder="Enter supplier name"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplierContact">
                  Supplier Contact
                </Label>
                <Input
                  id="supplierContact"
                  value={supplierInfo.supplierContact}
                  onChange={(e) =>
                    setSupplierInfo((prev) => ({
                      ...prev,
                      supplierContact: e.target.value,
                    }))
                  }
                  placeholder="+91 XXXXXXXXXX"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Purchase Date *</Label>
                <Input
                  id="date"
                  type="date"
                  value={supplierInfo.date}
                  onChange={(e) =>
                    setSupplierInfo((prev) => ({
                      ...prev,
                      date: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={supplierInfo.notes}
                  onChange={(e) =>
                    setSupplierInfo((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  placeholder="Any additional notes about this purchase..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paidAmount">
                  Paid Amount (INR)
                </Label>
                <Input
                  id="paidAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={supplierInfo.paidAmount}
                  onChange={(e) =>
                    setSupplierInfo((prev) => ({
                      ...prev,
                      paidAmount: e.target.value,
                    }))
                  }
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">
                  Payment Method
                </Label>
                <Select
                  value={supplierInfo.paymentMethod}
                  onValueChange={(value) =>
                    setSupplierInfo((prev) => ({
                      ...prev,
                      paymentMethod: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">
                      Bank Transfer
                    </SelectItem>
                    <SelectItem value="cheque">
                      Cheque
                    </SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {partyKeyPreview && priorOutstanding > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-sm font-semibold text-amber-900">
                    Previous purchase balance owed
                  </p>
                  <p className="text-xs text-amber-800">
                    Unpaid on past bills for this supplier/contact:{" "}
                    <span className="font-medium">
                      {formatINR(roundMoney(priorOutstanding))}
                    </span>
                  </p>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="carryPrevSupplierOutstanding"
                      checked={includePreviousOutstanding}
                      onCheckedChange={(checked) =>
                        setIncludePreviousOutstanding(Boolean(checked))
                      }
                    />
                    <label
                      htmlFor="carryPrevSupplierOutstanding"
                      className="text-sm leading-tight cursor-pointer"
                    >
                      Add this amount to this purchase invoice total (you still
                      owe the supplier)
                    </label>
                  </div>
                  {includePreviousOutstanding && (
                    <div className="space-y-2">
                      <Label htmlFor="carryAmountSupplier">
                        Amount to add (max{" "}
                        {formatINR(roundMoney(priorOutstanding))})
                      </Label>
                      <Input
                        id="carryAmountSupplier"
                        type="number"
                        step="0.01"
                        min={0}
                        max={priorOutstanding}
                        value={carryAmountStr}
                        onChange={(e) =>
                          setCarryAmountStr(e.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Cart */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5" />
                  Purchase Cart
                </span>
                <span className="text-sm font-normal text-gray-600">
                  {cart.length} item(s)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Cart is empty</p>
                  <p className="text-xs">
                    Add items to purchase
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {cart.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h5 className="font-medium text-sm text-gray-900">
                              {item.itemName}
                            </h5>
                            <p className="text-xs text-gray-600">
                              {item.sku}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              handleRemoveFromCart(index)
                            }
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Quantity:
                            </span>
                            <span className="font-medium">
                              {item.quantity} units
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">
                              Price/unit:
                            </span>
                            <span className="font-medium">
                              {formatINR(item.pricePerUnit)}
                            </span>
                          </div>
                          <div className="flex justify-between pt-1 border-t border-gray-300">
                            <span className="text-gray-700 font-medium">
                              Total:
                            </span>
                            <span className="font-semibold text-green-600">
                              {formatINR(item.totalPrice)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-300 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Total Items:
                      </span>
                      <span className="font-medium">
                        {totalItems} units
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        Line items subtotal:
                      </span>
                      <span className="font-medium text-green-700">
                        {formatINR(linesSubtotal)}
                      </span>
                    </div>
                    {includePreviousOutstanding && cappedCarry > 0 && (
                      <div className="flex justify-between text-xs text-amber-800">
                        <span>Prior unpaid (added):</span>
                        <span>{formatINR(cappedCarry)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-1">
                      <span className="font-semibold text-gray-900">
                        Invoice total:
                      </span>
                      <span className="font-bold text-xl text-green-600">
                        {formatINR(invoiceGrandTotal)}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmit}
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={
                      cart.length === 0 ||
                      !supplierInfo.supplierName
                    }
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Record Purchase & Generate Bill
                  </Button>
                </>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/inventory")}
                className="w-full"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}