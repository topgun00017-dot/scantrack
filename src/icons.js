// App icon set: outline icons from Lucide (ISC licence), imported one by one so only
// the icons used here are bundled. Use <Icon name="receipt" size={20} color={...} />.
import React from 'react';
import Wallet from 'lucide-react-native/icons/wallet';
import Receipt from 'lucide-react-native/icons/receipt';
import Camera from 'lucide-react-native/icons/camera';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Menu from 'lucide-react-native/icons/menu';
import Package from 'lucide-react-native/icons/package';
import Fuel from 'lucide-react-native/icons/fuel';
import Car from 'lucide-react-native/icons/car';
import Monitor from 'lucide-react-native/icons/monitor';
import Plane from 'lucide-react-native/icons/plane';
import Users from 'lucide-react-native/icons/users';
import HandCoins from 'lucide-react-native/icons/hand-coins';
import UtensilsCrossed from 'lucide-react-native/icons/utensils-crossed';
import Building from 'lucide-react-native/icons/building';
import Smartphone from 'lucide-react-native/icons/smartphone';
import FileText from 'lucide-react-native/icons/file-text';
import Shapes from 'lucide-react-native/icons/shapes';
import ChartPie from 'lucide-react-native/icons/chart-pie';
import Download from 'lucide-react-native/icons/download';
import Calculator from 'lucide-react-native/icons/calculator';
import Settings from 'lucide-react-native/icons/settings';
import FileSpreadsheet from 'lucide-react-native/icons/file-spreadsheet';
import Sheet from 'lucide-react-native/icons/sheet';
import FileArchive from 'lucide-react-native/icons/file-archive';
import Calendar from 'lucide-react-native/icons/calendar';
import TriangleAlert from 'lucide-react-native/icons/triangle-alert';
import FilePlus from 'lucide-react-native/icons/file-plus';
import ScanLine from 'lucide-react-native/icons/scan-line';
import Images from 'lucide-react-native/icons/images';
import Search from 'lucide-react-native/icons/search';
import CircleCheck from 'lucide-react-native/icons/circle-check';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import Circle from 'lucide-react-native/icons/circle';
import Check from 'lucide-react-native/icons/check';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import Plus from 'lucide-react-native/icons/plus';
import X from 'lucide-react-native/icons/x';
import Package2 from 'lucide-react-native/icons/package-open';
import { colors } from './theme';

const ICONS = {
  wallet: Wallet,
  receipt: Receipt,
  camera: Camera,
  sparkles: Sparkles,
  menu: Menu,
  package: Package,
  'package-open': Package2,
  fuel: Fuel,
  car: Car,
  monitor: Monitor,
  plane: Plane,
  users: Users,
  'hand-coins': HandCoins,
  utensils: UtensilsCrossed,
  building: Building,
  smartphone: Smartphone,
  'file-text': FileText,
  shapes: Shapes,
  'chart-pie': ChartPie,
  download: Download,
  calculator: Calculator,
  settings: Settings,
  'file-spreadsheet': FileSpreadsheet,
  sheet: Sheet,
  'file-archive': FileArchive,
  calendar: Calendar,
  alert: TriangleAlert,
  'file-plus': FilePlus,
  scan: ScanLine,
  images: Images,
  search: Search,
  'circle-check': CircleCheck,
  'circle-alert': CircleAlert,
  circle: Circle,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-down': ChevronDown,
  plus: Plus,
  x: X,
};

export const isIconName = (n) => typeof n === 'string' && !!ICONS[n];

export function Icon({ name, size = 20, color = colors.text, strokeWidth = 2, style }) {
  const C = ICONS[name];
  if (!C) return null;
  return <C size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}
