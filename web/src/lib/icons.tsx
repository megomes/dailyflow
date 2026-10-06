import {
  BookOpen, Briefcase, Car, Code, Coffee, Dumbbell, Gamepad2, Guitar, Hammer, Heart, Leaf, Moon, Music, Palette,
  Plane, ShoppingCart, Smartphone, Sparkles, Sun, Tv, User, Users, Utensils, Wrench, type LucideIcon,
} from 'lucide-react';
import type { ColorKey } from './types';

export const AREA_ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase, music: Music, guitar: Guitar, dumbbell: Dumbbell, heart: Heart, users: Users, wrench: Wrench,
  hammer: Hammer, code: Code, plane: Plane, coffee: Coffee, gamepad: Gamepad2, car: Car, user: User, moon: Moon,
  sun: Sun, book: BookOpen, leaf: Leaf, palette: Palette, utensils: Utensils, cart: ShoppingCart, sparkles: Sparkles,
  phone: Smartphone, tv: Tv,
};

export const AREA_ICON_KEYS = Object.keys(AREA_ICONS);

export const COLOR_KEYS: ColorKey[] = ['blue', 'purple', 'pink', 'red', 'orange', 'yellow', 'green', 'teal', 'cyan', 'indigo', 'gray'];

export function AreaIcon({ name, size = 14 }: { name: string; size?: number }) {
  const Icon = AREA_ICONS[name] ?? Sparkles;
  return <Icon size={size} strokeWidth={1.75} aria-hidden />;
}
