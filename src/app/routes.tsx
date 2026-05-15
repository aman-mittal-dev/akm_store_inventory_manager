import { createBrowserRouter } from "react-router";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { InventoryList } from "./components/InventoryList";
import { AddEditItem } from "./components/AddEditItem";
import { IncomingStock } from "./components/IncomingStock";
import { OutgoingStock } from "./components/OutgoingStock";
import { TransactionHistory } from "./components/TransactionHistory";
import { ViewBill } from "./components/ViewBill";
import { Analytics } from "./components/Analytics";
import { StoreSettings } from "./components/StoreSettings";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import { Pricing } from "./components/Pricing";
import { Checkout } from "./components/Checkout";
import { CheckoutSuccess } from "./components/CheckoutSuccess";
import { Account } from "./components/Account";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PublicRoute } from "./components/PublicRoute";
import { SubscriptionGuard } from "./components/SubscriptionGuard";
import { PartiesDirectory } from "./components/PartiesDirectory";
import { PartyDetail } from "./components/PartyDetail";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <PublicRoute>
        <Login />
      </PublicRoute>
    ),
  },
  {
    path: "/signup",
    element: (
      <PublicRoute>
        <Signup />
      </PublicRoute>
    ),
  },
  {
    path: "/pricing",
    element: (
      <ProtectedRoute>
        <Pricing />
      </ProtectedRoute>
    ),
  },
  {
    path: "/checkout",
    element: (
      <ProtectedRoute>
        <Checkout />
      </ProtectedRoute>
    ),
  },
  {
    path: "/checkout/success",
    element: (
      <ProtectedRoute>
        <CheckoutSuccess />
      </ProtectedRoute>
    ),
  },
  {
    path: "/account",
    element: (
      <ProtectedRoute>
        <Account />
      </ProtectedRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <SubscriptionGuard>
          <Layout />
        </SubscriptionGuard>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: "inventory", element: <InventoryList /> },
      { path: "add-item", element: <AddEditItem /> },
      { path: "edit-item/:id", element: <AddEditItem /> },
      { path: "incoming-stock", element: <IncomingStock /> },
      { path: "outgoing-stock", element: <OutgoingStock /> },
      { path: "transactions", element: <TransactionHistory /> },
      { path: "parties", element: <PartiesDirectory /> },
      { path: "parties/:partyKind/:partyKeyEncoded", element: <PartyDetail /> },
      { path: "analytics", element: <Analytics /> },
      { path: "settings", element: <StoreSettings /> },
      { path: "bill/:transactionId", element: <ViewBill /> },
    ],
  },
]);