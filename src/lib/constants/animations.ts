import { MOTION } from "@/lib/theme/tokens";
export const TRANSITION = {
  fast: `all ${MOTION.fast} ${MOTION.ease}`,
  base: `all ${MOTION.base} ${MOTION.ease}`,
  slow: `all ${MOTION.slow} ${MOTION.ease}`,
  colors: `color ${MOTION.base} ${MOTION.ease}, background-color ${MOTION.base} ${MOTION.ease}, border-color ${MOTION.base} ${MOTION.ease}`,
} as const;
