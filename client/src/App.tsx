import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import CampaignDetail from "@/pages/CampaignDetail";
import CampaignHistory from "@/pages/CampaignHistory";
import Home from "@/pages/Home";
import NewCampaign from "@/pages/NewCampaign";
import RecipientsDirectory from "@/pages/RecipientsDirectory";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function Router() {
  return <Switch><Route path="/" component={Home} /><Route path="/campagnes/nouvelle" component={NewCampaign} /><Route path="/campagnes" component={CampaignHistory} /><Route path="/campagnes/:id">{params => <CampaignDetail id={params.id} />}</Route><Route path="/destinataires" component={RecipientsDirectory} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
