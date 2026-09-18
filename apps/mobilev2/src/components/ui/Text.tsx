/**
 * Typography primitive.
 *
 * Every piece of text in the app goes through this so a font size can only ever
 * be one of the eleven the design defines. `variant` names the row on the
 * Penpot typography board; `tone` names a colour token. Neither takes a raw
 * value, which is what keeps the app from drifting off the design one `16` at a
 * time.
 */
import React from "react";
import { Text as RNText, type TextProps as RNTextProps } from "react-native";

import { color, type, type ColorToken, type TypeToken } from "@/design/tokens";

export interface TextProps extends RNTextProps {
  variant?: TypeToken;
  tone?: ColorToken;
  align?: "left" | "center" | "right";
}

export function Text({
  variant = "body",
  tone = "ink",
  align,
  style,
  ...rest
}: TextProps) {
  return (
    <RNText
      {...rest}
      style={[
        type[variant],
        { color: color[tone] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
