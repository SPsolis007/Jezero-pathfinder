"use strict";
// Archived MEDA Sol 1859 observations. Standalone: does not alter routing or map logic.
(() => {
  const dataUrl = "assets/meda_sol1859_summary.json";
  const container = document.getElementById("tab-environment");
  if (!container) return;
  const byId = id => document.getElementById(id);
  const fmt = (n, digits=2) => Number(n).toFixed(digits);
  const makeSvg = (name, attrs={}, parent) => {
    const el = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([k,v]) => el.setAttribute(k, String(v)));
    if (parent) parent.appendChild(el);
    return el;
  };
  const addText = (svg, str, x, y, attrs={}) => {
    const t = makeSvg("text", {x, y, ...attrs}, svg);
    t.textContent = str;
  };
  function plot(targetId, points, key, label, unit, pressure=false) {
    const target = byId(targetId);
    if (!target) return;
    target.replaceChildren();
    const valid = points.filter(p => Number.isFinite(p[key]));
    if (!valid.length) { target.textContent = "No valid observations"; return; }
    const W=660, H=226, left=57, right=14, top=16, bottom=42;
    const plotW=W-left-right, plotH=H-top-bottom;
    const nums=valid.map(p=>p[key]);
    let min=Math.min(...nums), max=Math.max(...nums);
    const span=max-min || 1;
    min-=span*0.08; max+=span*0.08;
    const x = i => left+(i/287)*plotW;
    const y = v => top+(max-v)/(max-min)*plotH;
    const svg=makeSvg("svg", {viewBox:`0 0 ${W} ${H}`, role:"img", "aria-label":`${label} on MEDA Sol 1859, plotted only for observed five-minute bins. Units: ${unit}.`}, target);
    for (let i=0;i<=4;i++) {
      const v=min+(max-min)*(4-i)/4;
      const yy=top+(plotH*i)/4;
      makeSvg("line", {x1:left,y1:yy,x2:W-right,y2:yy,class:"gridline"}, svg);
      addText(svg, `${fmt(v,pressure?0:1)} ${unit}`, left-6, yy+4, {"text-anchor":"end"});
    }
    [0,6,12,18,24].forEach(hour => {
      const xx=left+(hour/24)*plotW;
      addText(svg, `${String(hour).padStart(2,"0")}:00`, xx, H-19, {"text-anchor":"middle"});
    });
    // Break paths at empty bins; never draw across instrument sleep intervals.
    let current=[];
    const flush=()=>{
      if (!current.length) return;
      if (current.length===1) makeSvg("circle", {cx:current[0][0],cy:current[0][1],r:2.5,fill:pressure?"#f0b85a":"#25d5e6"}, svg);
      else makeSvg("polyline", {points:current.map(p=>p.join(",")).join(" "),class:pressure?"trace pressure-trace":"trace"}, svg);
      current=[];
    };
    points.forEach((p,i)=>{
      if (!Number.isFinite(p[key])) { flush(); return; }
      current.push([x(i), y(p[key])]);
    });
    flush();
    addText(svg, "Local Mean Solar Time", W/2, H-2, {"text-anchor":"middle"});
  }
  fetch(dataUrl, {cache:"no-store"})
    .then(response=>{
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data=>{
      if (!Array.isArray(data.bins) || data.bins.length!==288 || !data.summary) throw new Error("Unexpected MEDA summary format");
      byId("meda-observation-count").textContent=`${data.observations.toLocaleString()} matched ATS/pressure observations · ${data.bins.filter(b=>b.n>0).length} five-minute bins with measurements · Sol 1859 (archived)`;
      const renderTemp=()=>{
        const key=byId("meda-temp-sensor").value;
        const s=data.summary[key];
        if (!s) return;
        byId("meda-temp-mean").textContent=`${fmt(s.mean)} °C`;
        byId("meda-temp-range").textContent=`${fmt(s.min)} to ${fmt(s.max)} °C`;
        plot("meda-temp-chart",data.bins,key,key.toUpperCase()+" air temperature","°C");
      };
      const renderPressure=()=>{
        const key=byId("meda-pressure-sensor").value;
        const s=data.summary[key];
        if (!s) return;
        byId("meda-pressure-mean").textContent=`${fmt(s.mean)} Pa`;
        byId("meda-pressure-range").textContent=`${fmt(s.min)} to ${fmt(s.max)} Pa`;
        plot("meda-pressure-chart",data.bins,key,key.toUpperCase()+" pressure","Pa",true);
      };
      byId("meda-temp-sensor").addEventListener("change",renderTemp);
      byId("meda-pressure-sensor").addEventListener("change",renderPressure);
      renderTemp(); renderPressure();
    })
    .catch(err=>{
      console.error("Archived MEDA module:",err);
      byId("meda-observation-count").textContent=`MEDA measurements unavailable: ${err.message}. Serve the frontend through http://localhost:5500 rather than opening the HTML file directly.`;
    });
})();
