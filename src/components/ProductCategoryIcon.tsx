import {
  Armchair,
  BatteryCharging,
  Box,
  CircleStop,
  CloudRain,
  Cog,
  Disc3,
  Fan,
  Filter,
  Lightbulb,
  Link,
  PackageSearch,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

type ProductCategoryIconProps = {
  category?: string | null;
  productName?: string | null;
  className?: string;
  size?: number;
  colored?: boolean;
};

function OilBarrelIcon({ className, size, color }: { className?: string; size: number; color?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={color ? { color } : undefined}
      aria-hidden="true"
    >
      <ellipse cx="12" cy="4.5" rx="7" ry="2.5" />
      <path d="M5 4.5v15c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-15" />
      <path d="M5 9h14M5 17h14" />
    </svg>
  );
}

export function ProductCategoryIcon({
  category = "General",
  productName = "",
  className = "",
  size = 22,
  colored = false,
}: ProductCategoryIconProps) {
  const label = `${productName || ""} ${category || ""}`.toLowerCase();
  let Icon: LucideIcon = Box;
  let color = "#94a3b8";
  let oilBarrel = false;

  if ((category || "").toLowerCase() === "all") {
    Icon = PackageSearch;
    color = "#3b82f6";
  } else if (label.includes("barrel") || label.includes("drum")) {
    oilBarrel = true;
    color = "#f59e0b";
  } else if (label.includes("coolant") || label.includes("coolent") || label.includes("cooler") || label.includes("coolor") || label.includes("radiator")) {
    Icon = Fan;
    color = "#0ea5e9";
  } else if (label.includes("engine") || label.includes("motor oil") || label.includes("oil")) {
    oilBarrel = true;
    color = "#f59e0b";
  } else if (label.includes("gear") || label.includes("lubricant") || label.includes("grease")) {
    Icon = Cog;
    color = "#64748b";
  } else if (label.includes("filter")) {
    Icon = Filter;
    color = "#10b981";
  } else if (label.includes("brake") || label.includes("pad") || label.includes("shoe") || label.includes("disc")) {
    Icon = Disc3;
    color = "#ef4444";
  } else if (label.includes("batter")) {
    Icon = BatteryCharging;
    color = "#ca8a04";
  } else if (label.includes("spark") || label.includes("ignition") || label.includes("plug")) {
    Icon = Zap;
    color = "#8b5cf6";
  } else if (label.includes("wiper") || label.includes("wash")) {
    Icon = CloudRain;
    color = "#0ea5e9";
  } else if (label.includes("bulb") || label.includes("light") || label.includes("lamp")) {
    Icon = Lightbulb;
    color = "#eab308";
  } else if (label.includes("tire") || label.includes("tyre") || label.includes("wheel")) {
    Icon = CircleStop;
    color = "#334155";
  } else if (label.includes("belt") || label.includes("chain")) {
    Icon = Link;
    color = "#d97706";
  } else if (label.includes("suspension") || label.includes("shock") || label.includes("spring") || label.includes("tool") || label.includes("equipment") || label.includes("spare") || label.includes("part") || label.includes("general")) {
    Icon = Wrench;
    color = "#64748b";
  } else if (label.includes("polish") || label.includes("wax") || label.includes("cleaner") || label.includes("shampoo")) {
    Icon = Sparkles;
    color = "#ec4899";
  } else if (label.includes("accessory") || label.includes("mat") || label.includes("cover")) {
    Icon = Armchair;
    color = "#14b8a6";
  }

  const appliedColor = colored ? color : undefined;
  if (oilBarrel) return <OilBarrelIcon className={className} size={size} color={appliedColor} />;

  return (
    <Icon
      className={className}
      size={size}
      strokeWidth={1.9}
      style={appliedColor ? { color: appliedColor } : undefined}
      aria-hidden="true"
    />
  );
}
