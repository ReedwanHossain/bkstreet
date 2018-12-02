    // Initialization....................................................
    var map;
    var panos = [];
    var polyLine = [];
    var DATAPOINTS = [];
    var poly;
    var arrowHead;
    var loc;
    var PSV;
    var baseUrl = 'http://192.168.31.108:8085/'


    // Map Initialization..................................................
 
    map = L.map('map', {
        maxZoom: 24
    }).setView([23.80575424, 90.36923588], 15);

    var greenIcon = L.icon({
        iconUrl: '/assets/img/walk.png',

        iconSize: [33, 32], // size of the icon
        // the same for the shadow
        //popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
    });

    loc = L.marker([23.80575424, 90.36923588], {
        icon: greenIcon
    }).addTo(map)
    // .bindPopup('marker position')

    L.tileLayer('http://map.barikoi.xyz:8080/styles/klokantech-basic/{z}/{x}/{y}.png', {
        attribution: 'barikoi',
        maxZoom: 20
    }).addTo(map);


    // Polyline Color Generator function ......................................

    function getColor() {
        var o = Math.round,
            r = Math.random,
            s = 255;
        return 'rgb(' + o(r() * s) + ',' + o(r() * s) + ',' + o(r() * s) + ')';
        //return 'rgba(' + o(r()*s) + ',' + o(r()*s) + ',' + o(r()*s) + ',' + r().toFixed(1) + ')';

    }



    // App on-load................................................................

    $.ajax({
        type: "get", //send it through get method
        url: baseUrl+"Main-Road/all.json",
        success: function(response) {
            //Do Something
            console.log(response);
            //          map = L.map('map').setView([23.77116211, 90.35702678], 15);

            //          var greenIcon = L.icon({
            //     iconUrl: '/assets/img/walk.png',

            //     iconSize:     [33, 32], // size of the icon
            //    // the same for the shadow
            //     //popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
            // });

            //         loc =  L.marker([23.77116211, 90.35702678], {icon: greenIcon}).addTo(map)
            //         .bindPopup('marker position')
            DATAPOINTS = response;

            response.map(function(res) {
                polyLine = [];
                res.data.map(function(ary) {
                    polyLine.push([ary.latitude, ary.longitude]);
                })
                poly = new L.Polyline.PolylineEditor(polyLine, {
                    'label': res.name
                });
                poly.on('click', onPolyClick);
                poly.on('mouseover', function(e) {
                    var layer = e.target;
                    // console.log(e.target)

                    layer.setStyle({
                        color: 'red',
                        opacity: 1,
                        weight: 4,
                    });
                });

                poly.on('mouseout', function(e) {
                    var layer = e.target;

                    layer.setStyle({
                        color: '#4282F0',
                        opacity: 2,
                        weight: 4,
                        fillOpacity: 0.7,
                    });
                });
                poly.addTo(map);
                poly.setStyle({
                    color: '#4282F0',
                    opacity: 2,
                    fillOpacity: 0.7,
                    weight: 4,
                });


                //          arrowHead = L.polylineDecorator(poly, {
                //     patterns: [
                //         {offset: '100%', repeat: 0, symbol: L.Symbol.arrowHead({pixelSize: 15, polygon: false, pathOptions: {stroke: true}})}
                //     ]
                // }).addTo(map);


            });

           // map.fitBounds(poly.getBounds());


            // L.tileLayer('http://map.barikoi.xyz:8080/styles/klokantech-basic/{z}/{x}/{y}.png', {
            //     attribution: 'barikoi', maxZoom: 20
            // }).addTo(map);


        },
        error: function(err) {
            console.log(JSON.parse(err.responseText));
        }

    });



    // Polyline event listener.................................................


    var onPolyClick = function(event) {
        //callFancyboxIframe('flrs.html')
        var label = event.target.options.label;
        $('#photosphere').addClass('photosphere');
        $('#map').removeClass('premap');
        $('#map').addClass('map');
        // var content = event.target.options.popup;
        // var otherStuff = event.target.options.otherStuff;
        // alert("Clicked on polygon with label:" +label +" and content:" +content +". Also otherStuff set to:" +otherStuff);
        if (PSV != null) {
            PSV.destroy();

        }
        // loc = L.marker([panos[0].latitude, panos[0].longitude]).addTo(map)
        // .bindPopup('marker position');

        $.ajax({
            url: baseUrl+"Main-Road/" + label + "/" + label + ".json",
            type: "get", //send it through get method
            success: function(response) {
                //Do Something
                panos = response.data;
                //      var map = L.map('map').setView([panos[0].latitude, panos[0].longitude], 16);

                // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                //     attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                // }).addTo(map);
                 map.invalidateSize();
                map.setView([panos[0].latitude, panos[0].longitude], 15);
                loc.setLatLng([panos[0].latitude, panos[0].longitude]).update()
              

                var i = 0;

                console.log(panos[0].url)
                PSV = new PhotoSphereViewer({
                    container: 'photosphere',
                    panorama: panos[0].url,
                    caption: panos[0].desc,
                    loading_img: 'assets/photosphere-logo.gif',
                    // longitude_range: [-7 * Math.PI / 8, 7 * Math.PI / 8],
                    // latitude_range: [-3 * Math.PI / 4, 3 * Math.PI / 4],
                    anim_speed: '-2rpm',
                    default_fov: 50,
                    fisheye: true,
                    move_speed: 1.1,
                    time_anim: false,
                    touchmove_two_fingers: true,
                    //    mousemove_hover: true,
                    //    webgl: false,
                    navbar: [
                        'autorotate', 'zoom', 'download', 'markers',
                        {
                            title: 'Change image',
                            className: 'custom-button',
                            content: '<',
                            onClick: (function(e) {
                                // var i = 0;
                                var loading = false;
                                return function() {
                                    if (loading) {
                                        return;
                                    }


                                    if (i == 0) {
                                        i = panos.length - 1;
                                        loc.setLatLng([panos[i].latitude, panos[i].longitude]).update();
                                    } else {
                                        i = i - 1;
                                        loc.setLatLng([panos[i].latitude, panos[i].longitude]).update();
                                    }

                                    loading = false;
                                    PSV.clearMarkers();

                                    PSV.setPanorama(panos[i].url, panos[i].target, false)
                                        .then(function() {
                                            PSV.setCaption(panos[i].desc);
                                            loading = false;
                                        });
                                }
                            }())
                        }, {
                            title: 'Change image',
                            className: 'custom-button',
                            content: '>',
                            onClick: (function() {
                                // var i = 0;
                                var loading = false;

                                return function() {
                                    if (loading) {
                                        return;
                                    }
                                    if (i == panos.length - 1) {
                                        i = 0;
                                        loc.setLatLng([panos[i].latitude, panos[i].longitude]).update();
                                    } else {
                                        i = 1 + i;
                                        loc.setLatLng([panos[i].latitude, panos[i].longitude]).update();
                                    }
                                    loading = false;
                                    PSV.clearMarkers();

                                    PSV.setPanorama(panos[i].url, panos[i].target, false)
                                        .then(function() {
                                            PSV.setCaption(panos[i].desc);
                                            loading = false;
                                        });
                                }
                            }())
                        },
                        'caption', 'gyroscope', 'stereo', 'fullscreen'
                    ],

                });



            }

        })

        PSV.on('click', function(e) {
          PSV.addMarker({
            id: '#' + Math.random(),
            tooltip: 'Generated marker',
            longitude: e.longitude,
            latitude: e.latitude,
            image: 'assets/pin1.png',
            width: 32,
            height: 32,
            anchor: 'bottom center',
            data: {
              deletable: true
            }
          });
          console.log(e.longitude)
        });

        PSV.on('select-marker', function(marker, dblclick) {
          if (marker.data && marker.data.deletable) {
            if (dblclick) {
              PSV.removeMarker(marker);
            }
            else {
              PSV.updateMarker({
                id: marker.id,
                image: 'assets/pin2.png'
              });
            }
          }
        });

        PSV.on('over-marker', function(marker) {
          console.log('over', marker.id);
        });

        PSV.on('leave-marker', function(marker) {
          console.log('leave', marker.id);
        });

        PSV.on('select-marker-list', function(marker) {
          console.log('select-list', marker.id);
        });

        PSV.on('goto-marker-done', function(marker) {
          console.log('goto-done', marker.id);
        });
    };





    