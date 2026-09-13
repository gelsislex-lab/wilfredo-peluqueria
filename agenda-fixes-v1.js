// Mejoras Agenda Wilfredo v1
// Rama de prueba: mejoras-agenda-v1

window.hoyChile=function(){
  var parts=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Santiago',
    year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(new Date());
  var p={};
  parts.forEach(function(x){if(x.type!=='literal')p[x.type]=x.value;});
  return p.year+'-'+p.month+'-'+p.day;
};

// Calendario usando la fecha real de Chile, no UTC.
window.rCal=function(){
  document.getElementById('bk-ml').textContent=MONTHS[bkC.m]+' '+bkC.y;
  var dn=['D','L','M','X','J','V','S'],h=dn.map(function(d){return '<div class="date-dn">'+d+'</div>';}).join('');
  var first=new Date(bkC.y,bkC.m,1).getDay(),dim=new Date(bkC.y,bkC.m+1,0).getDate(),td=hoyChile();
  for(var i=0;i<first;i++)h+='<div class="date-btn empty"></div>';
  for(var d=1;d<=dim;d++){
    var ds=bkC.y+'-'+String(bkC.m+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    var dw=new Date(ds+'T12:00:00').getDay();
    var cls='date-btn';
    var esCV=(bk.svc==='Corte varon');
    var cerrado=esCV?(dw<2||dw>5):(dw===0||dw===1);
    if(cerrado)cls+=' closed';
    else if(ds<td)cls+=' past';
    else if(ds===bk.date)cls+=' selected';
    else cls+=' available';
    h+='<div class="'+cls+'" data-d="'+ds+'" onclick="sDate(this.dataset.d)">'+d+'</div>';
  }
  document.getElementById('bk-dgrid').innerHTML=h;
};

// Las reservas canceladas ya no consumen cupo.
window.cargarOcupados=async function(){
  bk._conteo={};
  if(!bk.svc||!bk.date)return true;
  try{
    var url='https://mdxgwjjxufkkgcjrkfeu.supabase.co/rest/v1/wf_reservas?select=hora&servicio=eq.'+encodeURIComponent(bk.svc)+'&fecha=eq.'+bk.date+'&estado=neq.cancelada';
    var r=await fetch(url,{headers:{'apikey':SB_ANON,'Authorization':'Bearer '+SB_ANON}});
    if(!r.ok)throw new Error('Supabase disponibilidad HTTP '+r.status);
    var data=await r.json();
    if(Array.isArray(data))data.forEach(function(x){
      var t=(x.hora||'').slice(0,5);
      bk._conteo[t]=(bk._conteo[t]||0)+1;
    });
    return true;
  }catch(e){
    console.error('Error cargando disponibilidad:',e);
    return false;
  }
};

// Guarda primero en Supabase y solo muestra exito si el servidor confirma.
window.confirmBooking=async function(){
  var nombre=document.getElementById('bk-name').value.trim();
  var tel=document.getElementById('bk-phone').value.trim();
  if(!nombre||!tel){alert('Ingresa tu nombre y telefono');return;}

  var limite=(bk.svc==='Corte varon')?1:2;
  try{
    var vurl='https://mdxgwjjxufkkgcjrkfeu.supabase.co/rest/v1/wf_reservas?select=hora&servicio=eq.'+encodeURIComponent(bk.svc)+'&fecha=eq.'+bk.date+'&hora=eq.'+bk.time+'&estado=neq.cancelada';
    var vr=await fetch(vurl,{headers:{'apikey':SB_ANON,'Authorization':'Bearer '+SB_ANON}});
    if(!vr.ok){
      console.error('Error revalidando cupo:',vr.status,await vr.text());
      alert('No pudimos verificar la disponibilidad. Intenta nuevamente en unos segundos.');
      return;
    }
    var vd=await vr.json();
    if(Array.isArray(vd)&&vd.length>=limite){
      alert('Lo sentimos, ese horario acaba de completarse. Por favor elige otro.');
      await cargarOcupados();
      goStep(3);
      return;
    }
  }catch(e){
    console.error('Error revalidando cupo:',e);
    alert('No pudimos verificar la disponibilidad. Revisa tu conexion e intenta nuevamente.');
    return;
  }

  var dt=new Date(bk.date+'T12:00:00');
  var dl=DS[dt.getDay()].charAt(0).toUpperCase()+DS[dt.getDay()].slice(1)+' '+dt.getDate()+' de '+MONTHS[dt.getMonth()];

  try{
    var pr=await fetch('https://mdxgwjjxufkkgcjrkfeu.supabase.co/rest/v1/wf_reservas',{
      method:'POST',
      headers:{
        'apikey':SB_ANON,
        'Authorization':'Bearer '+SB_ANON,
        'Content-Type':'application/json',
        'Prefer':'return=minimal'
      },
      body:JSON.stringify({
        nombre:nombre,
        telefono:tel,
        servicio:bk.svc,
        fecha:bk.date,
        hora:bk.time,
        estado:'pendiente'
      })
    });

    if(!pr.ok){
      var detalle=await pr.text();
      console.error('Error guardando reserva en Supabase:',pr.status,detalle);
      alert('No pudimos guardar tu reserva. Por favor intenta nuevamente o escribenos por WhatsApp.');
      return;
    }
  }catch(e){
    console.error('Error de red guardando reserva:',e);
    alert('No pudimos guardar tu reserva. Revisa tu conexion e intenta nuevamente.');
    return;
  }

  // Notificar solo despues de que Supabase confirmo el guardado.
  try{
    fetch('https://hook.us2.make.com/4q4wkediu29kwejgiz7pdsthhmnomegz',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({nombre:nombre,telefono:tel,servicio:bk.svc,fecha:bk.date,hora:bk.time})
    });
  }catch(e){console.error('Error webhook Make:',e);}

  var msg='Hola Wilfredo! Quiero reservar una hora:%0A'+
    '📋 *Servicio:* '+bk.svc+'%0A'+
    '📅 *Fecha:* '+dl+'%0A'+
    '🕐 *Hora:* '+bk.time+'%0A'+
    '👤 *Nombre:* '+nombre+'%0A'+
    '📞 *Teléfono:* '+tel;
  var waUrl='https://wa.me/56959837416?text='+msg;

  document.getElementById('bk-success-text').innerHTML=
    'Tu hora para <strong>'+bk.svc+'</strong><br>'+dl+' a las '+bk.time+
    '<br><br><a href="'+waUrl+'" target="_blank" style="display:inline-block;margin-top:14px;background:#25d366;color:#fff;padding:12px 24px;border-radius:99px;text-decoration:none;font-weight:600;font-size:16px">📲 Confirmar por WhatsApp</a>';
  goStep(5);
};
