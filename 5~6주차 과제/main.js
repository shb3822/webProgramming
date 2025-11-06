let topZIndex = 10;

// 드래그 가능하게 설정
document.querySelectorAll('.plant').forEach(plant => {
    plant.setAttribute('draggable', true);
    plant.addEventListener('dragstart', function(e) {
        e.dataTransfer.setData('text/plain', e.target.id);
    });

    // pointer 드래그 및 더블클릭도 설정
    dragElement(plant);
});

// 테라리움 요소
const terrarium = document.getElementById('terrarium');

// 반드시 있어야 드롭 가능
terrarium.addEventListener('dragover', function(e) {
    e.preventDefault();
});

// 드롭 이벤트 처리
terrarium.addEventListener('drop', function(e) {
    e.preventDefault();

    const plantId = e.dataTransfer.getData('text/plain');
    const plant = document.getElementById(plantId);

    const offsetX = e.clientX - terrarium.getBoundingClientRect().left;
    const offsetY = e.clientY - terrarium.getBoundingClientRect().top;

    plant.style.position = 'absolute';
    plant.style.left = `${offsetX}px`;
    plant.style.top = `${offsetY}px`;
    plant.style.zIndex = ++topZIndex;

    // 병 안으로 이동
    terrarium.appendChild(plant);

    // 드롭 후에도 다시 드래그/더블클릭 가능하게 재설정
    dragElement(plant);
});


// ⭐ 드래그 기능 + 더블 클릭 기능
function dragElement(terrariumElement) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    terrariumElement.onpointerdown = pointerDrag;

    terrariumElement.ondblclick = function () {
        terrariumElement.style.zIndex = ++topZIndex;
    };

    function pointerDrag(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onpointermove = elementDrag;
        document.onpointerup = stopElementDrag;
    }

    function elementDrag(e) {
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        terrariumElement.style.top = (terrariumElement.offsetTop - pos2) + "px";
        terrariumElement.style.left = (terrariumElement.offsetLeft - pos1) + "px";
    }

    function stopElementDrag() {
        document.onpointermove = null;
        document.onpointerup = null;
    }
}
