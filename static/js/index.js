(() => {
  "use strict";

  document.onreadystatechange = () => {
    if (document.readyState == "complete") {
      const createPingMs = (url, startMs, msg) => {
        const doc = document.querySelector(`[data-ping="${url}"]`);
        const endMs = Date.now();
        console.log(endMs - startMs);
        doc.innerHTML = msg || `${endMs - startMs} ms`;
      };

      const ping = (url, timeout = 3000) => {
        const img = new Image();
        const startMs = Date.now();
        const doc = document.querySelector(`[data-ping="${url}"]`);
        doc.innerHTML = `<div class="spinner-border spinner-border-sm" role="status"></div>`;

        let flag = false;
        img.onload = () => {
          if (!flag) {
            flag = true;
            createPingMs(url, startMs);
          }
        };
        img.onerror = (error) => {
          console.log(error);
          if (!flag) {
            flag = true;
            createPingMs(url, startMs);
          }
        };

        img.src = `${url}#${md5(`${startMs}${Math.random()}`)}.png`;

        setTimeout(() => {
          if (!flag) {
            flag = true;
            createPingMs(
              url,
              startMs,
              `<span class="text-danger">访问超时</span>`
            );
          }
        }, timeout);
      };

      const containerList = document.getElementById("list");
      const containerTest = document.getElementById("test");

      let mirrorImageList = [];
      const pingAll = () => {
        mirrorImageList.map((item) => ping(item.url));
      };

      fetch("mirrorImageList.json")
        .then((response) => response.json())
        .then((data) => {
          const html = data.map(
            (item) => `
          <div class="d-flex justify-content-between align-items-center pb-3 mb-3 small lh-sm border-bottom w-100">
          <div class="d-flex col-8 flex-column justify-content-start">
            <div class="d-flex align-items-center">
              <a target="_blank" class="link-success" href="${item.url}">${
              item.url
            }</a>
              <div class="fw-light ps-3" >
                <div data-ping="${item.url}">
                </div>
              </div>
            </div>
            <div class="fw-light mt-2">${item.tips || ""}</div>
          </div>
          <div class="d-grid col-4 gap-2">
            <button class="btn btn-primary" type="button">
              <a target="_blank" class="link-light text-decoration-none" href="${
                item.url
              }">立马访问</a>
            </button>
            <button class="btn btn-secondary" data-url="${
              item.url
            }"  type="button">测试延迟</button>
          </div>
        </div>
        `
          );

          containerList.innerHTML = html.join("");
          mirrorImageList = data;
          pingAll();
        });

      containerList.addEventListener("click", (e) => {
        const { url } = e.target.dataset;
        if (url) {
          ping(url);
        }
      });

      containerTest.addEventListener("click", () => {
        pingAll();
      });
    }
  };
})();
