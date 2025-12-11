import { LucideIcon } from 'lucide-react';

export interface FeatureItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface PricingPlan {
  name: string;
  price: string;
  limit: string;
  isPopular?: boolean;
  features: string[];
}
