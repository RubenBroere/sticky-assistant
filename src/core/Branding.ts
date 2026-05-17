export const BRANDING : Record<string, any> = {
  appName: "Sticky Assistant",
  primaryColor: "#FA6B20",
  tools: {
    actionPoints: {
      label: "Action Points",
      accentColor: "#FA6B20"
    },
    committees: {
      label: "Committees",
      accentColor: "#FA6B20"
    },
    driveComments: {
      label: "Drive Comments",
      accentColor: "#FA6B20"
    }
  }
};

export function getAppName() {
  return BRANDING.appName;
}

export function getToolTitle(toolKey: string) {
  const tool = BRANDING.tools[toolKey];
  const label = tool && tool.label ? tool.label : toolKey;
  return BRANDING.appName + " - " + label;
}

export function getToolAccent(toolKey: string) {
  const tool = BRANDING.tools[toolKey];
  return tool && tool.accentColor ? tool.accentColor : BRANDING.primaryColor;
}

export function getPrimaryColor() {
  return BRANDING.primaryColor;
}
