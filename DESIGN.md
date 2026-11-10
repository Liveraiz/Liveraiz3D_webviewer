---
version: alpha
name: LiverAIz 3D Viewer
description: Anatomy-first surgical model viewer with compact translucent controls.
colors:
  primary: '#3A98B9'
  lightText: '#222222'
  darkText: '#ffffff'
typography:
  sans:
    fontFamily: 'Pretendard, system-ui, sans-serif'
rounded:
  DEFAULT: '5px'
  tab: '12px'
spacing:
  panelPadding: '20px'
  rowGap: '15px'
---

## Overview

Product register: a 3D anatomy workstation for surgical planning. The model is the primary visual; compact controls provide anatomical navigation. Preserve the established viewer, not a marketing dashboard. English anatomical labels follow the existing UI; mesh names retain the author's spelling, including Korean. This document records existing runtime choices rather than generating tokens.

## Colors

`src/utils/Constants.js` owns PRIMARY_ACCENT (#3A98B9). `ObjectListPanel` owns translucent light/dark surfaces and row styling. Selection uses the accent plus a pressed state. GGO styling is a visualization of an explicitly supplied segmentation, not a diagnostic classification.

## Typography

Use the existing Pretendard stack. Category labels use 12–13px text and 600 weight for section headings. Keep original mesh names and tooltips readable.

## Layout

Keep the existing left object panel and bottom toolbar. Reuse the ROI vessel button for Planning; do not add a duplicate floating control. Category filters wrap within the panel. Rows retain visibility and opacity controls. Scroll belongs to the object panel.

## Elevation & Depth

Reuse the viewer's translucent panels, blur, and restrained border/shadow. Do not add cards over the anatomy canvas for this feature.

## Shapes

Rows and category headers use the existing 5px corners; category filter buttons use 12px corners.

## Components

Canonical owners: `Toolbar.createButton` for toolbar controls, `ObjectListPanel.createControlRow` for mesh controls, `createCategoryTabBar` for filters, and `createCategoryToggleRow` for category visibility. `LungVesselROI` owns active mode state and notifies the toolbar/panel after transitions. Buttons expose pressed state and remain keyboard operable.

Lung lists sort Lobes → Arteries → Veins → Bronchus → Cancer, then Other and Volumes. Planning adds category headings, counts, and group visibility controls. Unknown structures remain accessible. Mode and filter state are transient and reset on model changes. Non-lung lists keep their established layout.

## Do's and Don'ts

Preserve scene geometry and segmentation names. Keep GGO cloud texture stable while rotating the model. Do not infer GGO from an arbitrary cancer or infiltration mesh. Verify both themes and a narrow viewport before changing shared controls.
