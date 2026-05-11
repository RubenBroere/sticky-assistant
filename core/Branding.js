const BRANDING = {
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
    }
  }
};

function getAppName() {
  return BRANDING.appName;
}

function getToolTitle(toolKey) {
  const tool = BRANDING.tools[toolKey];
  const label = tool && tool.label ? tool.label : toolKey;
  return BRANDING.appName + " - " + label;
}

function getToolAccent(toolKey) {
  const tool = BRANDING.tools[toolKey];
  return tool && tool.accentColor ? tool.accentColor : BRANDING.primaryColor;
}

function getPrimaryColor() {
  return BRANDING.primaryColor;
}
