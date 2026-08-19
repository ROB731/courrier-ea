import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { useIsMobile } from "@/hooks/useMobile";
import { FilePlus2, History, LayoutDashboard, LockKeyhole, LogOut, PanelLeft, UsersRound } from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

const menuItems = [
  { icon: LayoutDashboard, label: "Vue d’ensemble", path: "/atelier" },
  { icon: FilePlus2, label: "Nouvelle campagne", path: "/campagnes/nouvelle" },
  { icon: History, label: "Historique", path: "/campagnes" },
  { icon: UsersRound, label: "Destinataires", path: "/destinataires" },
];

const SIDEBAR_WIDTH_KEY = "courrier-ea-sidebar-width";
const DEFAULT_WIDTH = 272;
const MIN_WIDTH = 236;
const MAX_WIDTH = 360;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f5f1] px-6">
        <div className="w-full max-w-md rounded-[2rem] border border-[#e6e1d9] bg-white p-9 text-center shadow-[0_24px_70px_rgba(32,36,30,0.10)]">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#123d35] font-serif text-xl text-[#f6e6ba]">CE</div>
          <h1 className="mt-6 font-serif text-3xl tracking-tight text-[#17251f]">COURRIER EA</h1>
          <p className="mt-3 text-sm leading-6 text-[#6d746e]">Accédez à votre atelier sécurisé de génération de courriers personnalisés.</p>
          <Button onClick={() => startLogin()} className="mt-7 h-11 w-full rounded-xl bg-[#123d35] hover:bg-[#0b2d27]">Se connecter</Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children, setSidebarWidth }: { children: React.ReactNode; setSidebarWidth: (width: number) => void }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeMenuItem = menuItems.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const nextWidth = event.clientX - sidebarLeft;
      if (nextWidth >= MIN_WIDTH && nextWidth <= MAX_WIDTH) setSidebarWidth(nextWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-[#e5e2db] bg-[#fbfaf7]" disableTransition={isResizing}>
          <SidebarHeader className="h-[88px] justify-center px-4">
            <div className="flex items-center gap-3">
              <button onClick={toggleSidebar} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#e5e2db] bg-white text-[#173e36] transition hover:bg-[#f2f0eb] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89c52]" aria-label="Réduire la navigation">
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="font-serif text-lg leading-none tracking-tight text-[#173e36]">COURRIER EA</p>
                  <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a7a40]">Atelier courrier</p>
                </div>
              )}
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3 pt-3">
            {!isCollapsed && <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#9a9b95]">Espace de travail</p>}
            <SidebarMenu className="gap-1">
              {menuItems.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-11 rounded-xl px-3 text-[#4d5a53] hover:bg-[#eef1ed] hover:text-[#173e36] data-[active=true]:bg-[#123d35] data-[active=true]:text-white">
                      <item.icon className="h-[18px] w-[18px]" />
                      <span className="font-medium">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>
          <SidebarFooter className="p-3">
            {!isCollapsed && <div className="mb-3 flex items-center gap-2 rounded-xl bg-[#eef1ed] px-3 py-2.5 text-xs text-[#587068]"><LockKeyhole className="h-3.5 w-3.5 text-[#9a7a40]" /> Fichiers chiffrés sur S3</div>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-[#eef1ed] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c89c52]">
                  <Avatar className="h-9 w-9 shrink-0 border border-[#e5e2db]"><AvatarFallback className="bg-[#efe8d8] text-xs font-semibold text-[#173e36]">{user?.name?.charAt(0).toUpperCase() || "U"}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium text-[#26362f]">{user?.name || "Utilisateur"}</p><p className="mt-0.5 truncate text-xs text-[#8a918c]">Compte sécurisé</p></div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 rounded-xl">
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive"><LogOut className="mr-2 h-4 w-4" />Se déconnecter</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition hover:bg-[#c89c52]/30 ${isCollapsed ? "hidden" : ""}`} onMouseDown={() => setIsResizing(true)} />
      </div>
      <SidebarInset className="bg-[#f7f5f1]">
        {isMobile && <div className="sticky top-0 z-40 flex h-16 items-center border-b border-[#e5e2db] bg-[#fbfaf7]/95 px-4 backdrop-blur"><SidebarTrigger className="mr-3 rounded-xl" /><span className="font-serif text-lg text-[#173e36]">{activeMenuItem?.label || "COURRIER EA"}</span></div>}
        <main className="min-h-screen p-4 sm:p-7 lg:p-10">{children}</main>
      </SidebarInset>
    </>
  );
}
