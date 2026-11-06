import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  ScreenShape,
  ScreenSpaceUI,
  type ScreenTransform2DSettings,
} from "@vincentt-xr/sdk";
import { useFaceInfo } from "@vincentt-xr/sdk/tracking";

import { feedRectToScreen } from "./screenFit";

export type FaceBoundingBoxProps = {
  color?: string;
  padding?: number;
  opacity?: number;
  strokeWidth?: number;
  renderOrder?: number;
};

const createFaceTransform = (
  face: ReturnType<typeof useFaceInfo>,
  viewportSize: { width: number; height: number },
  padding: number,
  renderOrder: number,
): ScreenTransform2DSettings | null => {
  if (!face || viewportSize.width <= 0 || viewportSize.height <= 0) return null;

  const { position, size } = feedRectToScreen(face.bounds, viewportSize, padding);

  return {
    enabled: true,
    position,
    size,
    pivot: [0.5, 0.5],
    rotation: 0,
    scale2D: { x: 1, y: 1 },
    referencePixelsPerUnit: 32,
    renderOrder,
    overlay: true,
    visible: true,
    showTransformGuides: false,
  };
};

export const FaceBoundingBox = ({
  color = "#22d3ee",
  padding = 14,
  opacity = 0.95,
  strokeWidth = 4,
  renderOrder = 1120,
}: FaceBoundingBoxProps) => {
  const face = useFaceInfo({ targetFps: 24, holdMs: 180 });
  const { size: viewportSize } = useThree();
  const transform = useMemo(
    () => createFaceTransform(face, viewportSize, Math.max(0, padding), renderOrder),
    [face, padding, renderOrder, viewportSize],
  );

  if (!transform) return null;

  return (
    <ScreenSpaceUI depth={0.01}>
      <ScreenShape
        name="faceBoundingBox"
        transform={transform}
        settings={{
          kind: "rectangle",
          fillOpacity: 0,
          strokeColor: color,
          strokeOpacity: opacity,
          strokeWidth,
        }}
      />
    </ScreenSpaceUI>
  );
};
