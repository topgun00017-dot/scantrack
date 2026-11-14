// Outline icons from Lucide (ISC licence), imported one by one so only these are bundled.
import React from 'react';
import I_FolderCheck from 'lucide-react-native/icons/folder-check';
import I_RotateCw from 'lucide-react-native/icons/undo-2';
import I_Bookmark from 'lucide-react-native/icons/bookmark';
import I_Briefcase from 'lucide-react-native/icons/briefcase';
import I_Sun from 'lucide-react-native/icons/sun';
import I_Coffee from 'lucide-react-native/icons/coffee';
import I_ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import I_Film from 'lucide-react-native/icons/film';
import I_Heart from 'lucide-react-native/icons/heart';
import I_BookOpen from 'lucide-react-native/icons/book-open';
import I_Dumbbell from 'lucide-react-native/icons/dumbbell';
import I_House from 'lucide-react-native/icons/house';
import I_Plane from 'lucide-react-native/icons/plane';
import I_Headphones from 'lucide-react-native/icons/headphones';
import I_Star from 'lucide-react-native/icons/star';
import I_Gift from 'lucide-react-native/icons/gift';
import I_GraduationCap from 'lucide-react-native/icons/graduation-cap';
import I_Car from 'lucide-react-native/icons/car';
import I_Wallet from 'lucide-react-native/icons/wallet';
import I_Leaf from 'lucide-react-native/icons/leaf';
import I_PawPrint from 'lucide-react-native/icons/paw-print';
import I_ListTodo from 'lucide-react-native/icons/list-todo';
import I_Inbox from 'lucide-react-native/icons/inbox';
import I_Search from 'lucide-react-native/icons/search';
import I_Calendar from 'lucide-react-native/icons/calendar';
import I_Settings from 'lucide-react-native/icons/settings';
import I_ChevronLeft from 'lucide-react-native/icons/chevron-left';
import I_ChevronRight from 'lucide-react-native/icons/chevron-right';
import I_ChevronDown from 'lucide-react-native/icons/chevron-down';
import I_ChevronUp from 'lucide-react-native/icons/chevron-up';
import I_EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import I_X from 'lucide-react-native/icons/x';
import I_Plus from 'lucide-react-native/icons/plus';
import I_Bell from 'lucide-react-native/icons/bell';
import I_BellOff from 'lucide-react-native/icons/bell-off';
import I_Repeat from 'lucide-react-native/icons/repeat';
import I_Flag from 'lucide-react-native/icons/flag';
import I_Link from 'lucide-react-native/icons/link';
import I_FileText from 'lucide-react-native/icons/file-text';
import I_Check from 'lucide-react-native/icons/check';
import I_Trash from 'lucide-react-native/icons/trash';
import I_Pencil from 'lucide-react-native/icons/pencil';
import I_Clock from 'lucide-react-native/icons/clock';
import I_Eye from 'lucide-react-native/icons/eye';
import I_EyeOff from 'lucide-react-native/icons/eye-off';
import I_CalendarClock from 'lucide-react-native/icons/calendar-clock';
import I_CalendarCheck from 'lucide-react-native/icons/calendar-check';
import I_CircleAlert from 'lucide-react-native/icons/circle-alert';
import I_ArrowDownUp from 'lucide-react-native/icons/arrow-down-up';
import I_RotateCcw from 'lucide-react-native/icons/rotate-ccw';
import I_CalendarDays from 'lucide-react-native/icons/calendar-days';
import I_SunMedium from 'lucide-react-native/icons/sun-medium';

const MAP = {
  'folder-check': I_FolderCheck,
  'undo': I_RotateCw,
  'bookmark': I_Bookmark,
  'briefcase': I_Briefcase,
  'sun': I_Sun,
  'coffee': I_Coffee,
  'shopping-cart': I_ShoppingCart,
  'film': I_Film,
  'heart': I_Heart,
  'book-open': I_BookOpen,
  'dumbbell': I_Dumbbell,
  'house': I_House,
  'plane': I_Plane,
  'headphones': I_Headphones,
  'star': I_Star,
  'gift': I_Gift,
  'graduation-cap': I_GraduationCap,
  'car': I_Car,
  'wallet': I_Wallet,
  'leaf': I_Leaf,
  'paw-print': I_PawPrint,
  'list-todo': I_ListTodo,
  'inbox': I_Inbox,
  'search': I_Search,
  'calendar': I_Calendar,
  'settings': I_Settings,
  'chevron-left': I_ChevronLeft,
  'chevron-right': I_ChevronRight,
  'chevron-down': I_ChevronDown,
  'chevron-up': I_ChevronUp,
  'ellipsis-vertical': I_EllipsisVertical,
  'x': I_X,
  'plus': I_Plus,
  'bell': I_Bell,
  'bell-off': I_BellOff,
  'repeat': I_Repeat,
  'flag': I_Flag,
  'link': I_Link,
  'file-text': I_FileText,
  'check': I_Check,
  'trash': I_Trash,
  'pencil': I_Pencil,
  'clock': I_Clock,
  'eye': I_Eye,
  'eye-off': I_EyeOff,
  'calendar-clock': I_CalendarClock,
  'calendar-check': I_CalendarCheck,
  'circle-alert': I_CircleAlert,
  'arrow-down-up': I_ArrowDownUp,
  'rotate-ccw': I_RotateCcw,
  'calendar-days': I_CalendarDays,
  'sun-medium': I_SunMedium,
};

export function Icon({ name, size = 20, color = '#1D1D1F', strokeWidth = 1.8, style }) {
  const C = MAP[name] || MAP.bookmark;
  return <C size={size} color={color} strokeWidth={strokeWidth} style={style} />;
}
