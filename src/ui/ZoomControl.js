import * as THREE from "three";

export default class ZoomControl {
    constructor({
        camera,
        controlManager,
        textPanel = null,
        isDarkMode = false,
        isMobile = false,
        verticalOffset = -120,
        onRequestRender = null,
    }) {
        this.camera = camera;
        this.controlManager = controlManager;
        this.textPanel = textPanel;
        this.isDarkMode = isDarkMode;
        this.isMobile = isMobile;
        this.onRequestRender = onRequestRender;
        this.verticalOffset = verticalOffset;

        this.container = null;
        this.zoomInButton = null;
        this.zoomOutButton = null;
        this.styleTag = null;
        this.animationFrame = null;
        this.panelObserver = null;

        this.minRightOffset = 16;
        this.panelOverlap = 24;

        if (!this.isMobile) {
            this.createUI();
            this.attachPanelObserver();
            this.updatePosition();
        }
    }

    createUI() {
        this.injectStyles();

        this.container = document.createElement("div");
        this.container.className = `zoom-control ${this.isDarkMode ? "zoom-control--dark" : "zoom-control--light"}`;
        this.container.setAttribute("aria-label", "Zoom controls");

        this.zoomInButton = this.createButton("+", "Zoom in", "zoom-in");
        this.zoomOutButton = this.createButton("&minus;", "Zoom out", "zoom-out");

        this.zoomInButton.addEventListener("click", () => this.animateZoom("in"));
        this.zoomOutButton.addEventListener("click", () => this.animateZoom("out"));

        this.container.appendChild(this.zoomInButton);
        this.container.appendChild(this.zoomOutButton);
        document.body.appendChild(this.container);

        window.addEventListener("resize", this.handleWindowResize);
    }

    createButton(label, title, idSuffix) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "zoom-control__button";
        button.setAttribute("aria-label", title);
        button.setAttribute("title", title);
        button.dataset.zoomAction = idSuffix;
        button.innerHTML = label;
        return button;
    }

    injectStyles() {
        if (document.querySelector("style[data-zoom-control='true']")) {
            return;
        }

        const style = document.createElement("style");
        style.setAttribute("data-zoom-control", "true");
        style.textContent = `
            .zoom-control {
                position: fixed;
                top: calc(50% + ${this.verticalOffset}px);
                transform: translateY(-50%);
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 10px;
                border-radius: 42px;
                background: rgba(255, 255, 255, 0.28);
                border: 1px solid rgba(255, 255, 255, 0.18);
                backdrop-filter: blur(18px) saturate(140%);
                box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
                z-index: 940;
                pointer-events: auto;
                transition: right 0.2s ease;
            }

            .zoom-control__button {
                width: 64px;
                height: 64px;
                border-radius: 999px;
                border: 1px solid rgba(255, 255, 255, 0.15);
                background: rgba(255, 255, 255, 0.4);
                color: #0b0f1a;
                font-size: 32px;
                font-weight: 600;
                line-height: 1;
                cursor: pointer;
                backdrop-filter: blur(18px) saturate(140%);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2),
                    0 6px 16px rgba(0, 0, 0, 0.12),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
                transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease;
            }

            .zoom-control__button:hover {
                background: rgba(255, 255, 255, 0.55);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.3),
                    0 8px 20px rgba(0, 0, 0, 0.16),
                    inset 0 1px 0 rgba(255, 255, 255, 0.25);
            }

            .zoom-control__button:active {
                transform: scale(0.96);
            }

            .zoom-control__button:focus-visible {
                outline: 3px solid rgba(64, 165, 255, 0.6);
                outline-offset: 3px;
            }

            .zoom-control--dark .zoom-control__button {
                background: rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.08);
                color: #f6f8ff;
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08),
                    0 8px 18px rgba(0, 0, 0, 0.32),
                    inset 0 1px 0 rgba(255, 255, 255, 0.1);
            }

            .zoom-control--dark .zoom-control__button:hover {
                background: rgba(0, 0, 0, 0.55);
                box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.16),
                    0 10px 22px rgba(0, 0, 0, 0.38),
                    inset 0 1px 0 rgba(255, 255, 255, 0.14);
            }

            .zoom-control--dark {
                background: rgba(0, 0, 0, 0.28);
                border: 1px solid rgba(255, 255, 255, 0.08);
                box-shadow: 0 8px 18px rgba(0, 0, 0, 0.32);
            }
        `;

        document.head.appendChild(style);
        this.styleTag = style;
    }

    animateZoom(direction) {
        const controls = this.controlManager?.controls;
        if (controls && (typeof controls.dollyIn === "function" || typeof controls.dollyOut === "function")) {
            this.animateControlsDolly(controls, direction);
            return;
        }

        if (this.camera) {
            this.animateCameraZoom(direction);
        }
    }

    animateControlsDolly(controls, direction) {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        const totalScale = 1.18;
        const duration = 220;
        const start = performance.now();
        let previousEase = 0;

        const step = (now) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / duration, 1);
            const eased = t * (2 - t);
            const delta = eased - previousEase;
            const stepScale = Math.pow(totalScale, delta);

            if (direction === "in" && typeof controls.dollyIn === "function") {
                controls.dollyIn(stepScale);
            } else if (direction === "out" && typeof controls.dollyOut === "function") {
                controls.dollyOut(stepScale);
            }

            controls.update();
            if (this.onRequestRender) {
                this.onRequestRender();
            }

            previousEase = eased;

            if (t < 1) {
                this.animationFrame = requestAnimationFrame(step);
            }
        };

        this.animationFrame = requestAnimationFrame(step);
    }

    animateCameraZoom(direction) {
        if (!this.camera) return;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        const duration = 220;
        const start = performance.now();
        const zoomFactor = direction === "in" ? 0.85 : 1.18;
        const target = this.controlManager?.controls?.target
            ? this.controlManager.controls.target.clone()
            : new THREE.Vector3(0, 0, 0);

        const startPosition = this.camera.position.clone();
        const targetVector = startPosition.clone().sub(target);
        const targetDistance = targetVector.length() * zoomFactor;

        const step = (now) => {
            const elapsed = now - start;
            const t = Math.min(elapsed / duration, 1);
            const eased = t * (2 - t);
            const currentDistance = THREE.MathUtils.lerp(targetVector.length(), targetDistance, eased);
            const directionVector = targetVector.clone().normalize();

            this.camera.position.copy(directionVector.multiplyScalar(currentDistance).add(target));
            this.camera.updateProjectionMatrix();

            if (this.onRequestRender) {
                this.onRequestRender();
            }

            if (t < 1) {
                this.animationFrame = requestAnimationFrame(step);
            }
        };

        this.animationFrame = requestAnimationFrame(step);
    }

    updateTheme(isDarkMode) {
        this.isDarkMode = isDarkMode;
        if (this.container) {
            this.container.classList.toggle("zoom-control--dark", isDarkMode);
            this.container.classList.toggle("zoom-control--light", !isDarkMode);
        }
    }

    updatePosition() {
        if (!this.container) return;

        const panelWidth = this.getPanelWidth();
        const isPanelOpen = this.isPanelOpen();
        const targetOffset = isPanelOpen ? panelWidth : 0;
        const right = Math.max(this.minRightOffset, targetOffset - this.panelOverlap);

        this.container.style.right = `${right}px`;
    }

    getPanelWidth() {
        if (this.textPanel && typeof this.textPanel.currentWidth === "number") {
            return this.textPanel.currentWidth;
        }

        const panel = document.querySelector(".text-panel");
        if (panel) {
            const width = parseFloat(panel.style.width || panel.getBoundingClientRect().width);
            return Number.isFinite(width) && width > 0 ? width : 250;
        }

        return 250;
    }

    isPanelOpen() {
        if (this.textPanel && typeof this.textPanel.isOpen === "boolean") {
            return this.textPanel.isOpen;
        }

        const panel = document.querySelector(".text-panel");
        if (!panel) return false;

        const right = panel.style.right || "";
        return panel.style.display !== "none" && right === "0px";
    }

    attachPanelObserver() {
        const panel = this.textPanel?.panel || document.querySelector(".text-panel");
        const resizeHandle = this.textPanel?.resizeHandle || document.querySelector(".text-panel-resize-handle");

        if (!panel) return;

        this.panelObserver = new MutationObserver(() => this.updatePosition());
        this.panelObserver.observe(panel, { attributes: true, attributeFilter: ["style", "class"] });

        if (resizeHandle) {
            this.panelObserver.observe(resizeHandle, { attributes: true, attributeFilter: ["style", "class"] });
        }
    }

    handleWindowResize = () => {
        this.updatePosition();
    };
}
