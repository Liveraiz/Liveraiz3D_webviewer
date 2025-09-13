addAnimationControls(container) {
    // 기존 애니메이션 컨트롤 제거
    this.removeAnimationControls();
    
    // 애니메이션 컨트롤 섹션 생성
    const section = document.createElement('div');
    section.className = 'toolbar-section animation-section';
    section.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.5);
        border-radius: 5px;
        margin: 5px;
    `;
    
    // 섹션 제목
    const title = document.createElement('div');
    title.className = 'section-title';
    title.textContent = '애니메이션 컨트롤';
    title.style.cssText = `
        color: white;
        font-size: 14px;
        font-weight: bold;
        margin-bottom: 5px;
    `;
    
    section.appendChild(title);
    section.appendChild(container);
    
    // 툴바에 섹션 추가
    this.container.appendChild(section);
}

removeAnimationControls() {
    const section = this.container.querySelector('.animation-section');
    if (section) {
        section.remove();
    }
}

showAnimationControls(show) {
    console.log("showAnimationControls called with:", show);
    
    // 애니메이션 섹션이 없으면 생성
    let animationSection = this.container.querySelector('.animation-section');
    if (!animationSection && show) {
        animationSection = document.createElement('div');
        animationSection.className = 'toolbar-section animation-section';
        animationSection.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 10px;
            background: rgba(0, 0, 0, 0.5);
            border-radius: 5px;
            margin: 5px;
        `;
        
        // 섹션 제목
        const title = document.createElement('div');
        title.className = 'section-title';
        title.textContent = '애니메이션 컨트롤';
        title.style.cssText = `
            color: white;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 5px;
        `;
        
        animationSection.appendChild(title);
        this.container.appendChild(animationSection);
    }

    // 애니메이션 버튼이 없으면 생성
    if (!this.animationButton && show) {
        this.createAnimationButton();
    }

    // 애니메이션 섹션 표시/숨김
    if (animationSection) {
        animationSection.style.display = show ? 'flex' : 'none';
    }
}

createAnimationButton() {
    if (this.animationButton) return;

    const button = document.createElement('button');
    button.className = 'toolbar-button animation-button';
    button.innerHTML = '▶';
    button.title = '애니메이션 재생';
    button.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 16px;
        cursor: pointer;
        padding: 5px;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
    `;

    // 애니메이션 섹션에 버튼 추가
    const animationSection = this.container.querySelector('.animation-section');
    if (animationSection) {
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'animation-button-container';
        buttonContainer.style.cssText = `
            display: flex;
            gap: 5px;
            margin-bottom: 5px;
        `;
        buttonContainer.appendChild(button);
        animationSection.insertBefore(buttonContainer, animationSection.firstChild.nextSibling);
    }

    this.animationButton = button;
    console.log("Animation button created");
}

toggleAnimation() {
    if (!this.animationButton) {
        console.warn("Animation button not initialized");
        this.createAnimationButton();
        return;
    }

    const isPlaying = this.animationButton.classList.contains('active');
    this.animationButton.innerHTML = isPlaying ? '▶' : '⏸';
    this.animationButton.classList.toggle('active');
    this.animationButton.style.background = isPlaying ? 
        'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.3)';
}

stopAnimation() {
    if (!this.animationButton) {
        console.warn("Animation button not initialized");
        this.createAnimationButton();
        return;
    }

    this.animationButton.innerHTML = '▶';
    this.animationButton.classList.remove('active');
    this.animationButton.style.background = 'rgba(255, 255, 255, 0.2)';
} 