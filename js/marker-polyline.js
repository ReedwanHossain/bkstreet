L.Polyline.polylineEditor = L.Polyline.extend({
    /**
     * Will add all needed methods to this polyline.
     */
    _addMethods: function() {
        var that = this;

        this._init = function(options, contexts) {
            // Container for all editable polylines on this map:
            if (!('_editablePolylines' in this._map)) {
                this._map._editablePolylines = [];
            }

            /*
             * Utility method added to this map to retreive editable 
             * polylines.
             */
            if (!this._map.getEditablePolylines) {
                this._map.getEditablePolylines = function() {
                    return that._map._editablePolylines;
                }
            }

            /**
             * Since all point editing is done by marker events, markers 
             * will be the main holder of the polyline points locations.
             * Every marker contains a reference to the newPointMarker 
             * *before* him (=> the first marker has newPointMarker=null).
             */
            this._parseOptions(options);

            this._markers = [];
            var that = this;
            var points = this.getLatLngs();
            var length = points.length;
            for (var i = 0; i < length; i++) {
                var marker = this._addMarkers(i, points[i]);
                marker.context = that._contexts == null ? {} : contexts[i];

                if (marker.context && !('originalPointNo' in marker.context))
                    marker.context.originalPointNo = i;
                if (marker.context && !('originalPolylineNo' in marker.context))
                    marker.context.originalPolylineNo = that._map._editablePolylines.length;
            }

            var map = this._map;
            this._map.on("zoomend", function(e) {
                that._showBoundMarkers();
            });
            this._map.on("moveend", function(e) {
                that._showBoundMarkers();
            });

            this._map._editablePolylines.push(this);
        };

        /**
         * Check if there is *any* busy editable polyline on this map.
         */
        this.isBusy = function() {
            for (var i = 0; i < that._map._editablePolylines.length; i++)
                if (that._map._editablePolylines[i]._isBusy())
                    return true;

            return false;
        };

        /**
         * Check if is busy adding/moving new nodes. Note, there may be 
         * *other* editable polylines on the same map which *are* busy.
         */
        this._isBusy = function() {
            return that._busy;
        };

        this._setBusy = function(busy) {
            that._busy = busy;
        };

        /**
         * Get markers for this polyline.
         */
        this.getPoints = function() {
            return this._markers;
        };

        this._parseOptions = function(options) {
            if (!options)
                options = {};

            // Do not show edit markers if more than maxMarkers would be shown:
            if (!('maxMarkers' in options)) {
                options.maxMarkers = 100;
            }
            this.maxMarkers = options.maxMarkers;

            // Icons:
            if (options.pointIcon) {
                this.pointIcon = options.pointIcon;
            } else {
                this.pointIcon = L.icon({
                    iconUrl: 'editmarker.png',
                    iconSize: [11, 11],
                    iconAnchor: [6, 6],
                });
            }
            if (options.newPointIcon) {
                this.newPointIcon = options.newPointIcon;
            } else {
                this.newPointIcon = L.icon({
                    iconUrl: 'editmarker2.png',
                    iconSize: [11, 11],
                    iconAnchor: [6, 6],
                });
            }
        };

        /**
         * Show only markers in current map bounds *is* there are only a certain 
         * number of markers. This method is called on eventy that change map 
         * bounds.
         */
        this._showBoundMarkers = function() {
            if (that.isBusy()) {
                console.log('Do not show because busy!');
                return;
            }

            var bounds = that._map.getBounds();
            var found = 0;
            for (var polylineNo in that._map._editablePolylines) {
                var polyline = that._map._editablePolylines[polylineNo];
                for (var markerNo in polyline._markers) {
                    var marker = polyline._markers[markerNo];
                    if (bounds.contains(marker.getLatLng()))
                        found += 1;
                    //console.log(marker.getLatLng())
                }
            }

           // console.log('found=' + found);

            for (var polylineNo in that._map._editablePolylines) {
                var polyline = that._map._editablePolylines[polylineNo];
                for (var markerNo in polyline._markers) {
                    var marker = polyline._markers[markerNo];
                    if (found < that.maxMarkers) {
                        that._setMarkerVisible(marker, bounds.contains(marker.getLatLng()));
                        that._setMarkerVisible(marker.newPointMarker, markerNo > 0 && bounds.contains(marker.getLatLng()));
                    } else {
                        that._setMarkerVisible(marker, false);
                        that._setMarkerVisible(marker.newPointMarker, false);
                    }
                }
            }
        };

        /**
         * Used when adding/moving points in order to disable the user to mess 
         * with other markers (+ easier to decide where to put the point 
         * without too many markers).
         */
        this._hideAll = function(except) {
            for (var polylineNo in that._map._editablePolylines) {
                console.log("hide " + polylineNo + " markers");
                var polyline = that._map._editablePolylines[polylineNo];
                for (var markerNo in polyline._markers) {
                    var marker = polyline._markers[markerNo];
                    if (except == null || except != marker)
                        polyline._setMarkerVisible(marker, false);
                    if (except == null || except != marker.newPointMarker)
                        polyline._setMarkerVisible(marker.newPointMarker, false);
                }
            }
        }

        /**
         * Show/hide marker.
         */
        this._setMarkerVisible = function(marker, show) {
            if (!marker)
                return;

            var map = this._map;
            if (show) {
                if (!marker._visible) {
                    if (!marker._map) { // First show fo this marker:
                        marker.addTo(map);
                    } else { // Marker was already shown and hidden:
                        map.addLayer(marker);
                    }
                    marker._map = map;
                }
                marker._visible = true;
            } else {
                if (marker._visible) {
                    map.removeLayer(marker);
                }
                marker._visible = false;
            }
        };

        /**
         * Reload polyline. If it is busy, then the bound markers will not be 
         * shown. Call _setBusy(false) before this method!
         */
        this._reloadPolyline = function(fixAroundPointNo) {
            that.setLatLngs(that._getMarkerLatLngs());
            if (fixAroundPointNo != null)
                that._fixNeighbourPositions(fixAroundPointNo);
            that._showBoundMarkers();
        }

        /**
         * Add two markers (a point marker and his newPointMarker) for a 
         * single point.
         *
         * Markers are not added on the map here, the marker.addTo(map) is called 
         * only later when needed first time because of performance issues.
         */
        this._addMarkers = function(pointNo, latLng, fixNeighbourPositions) {
            var that = this;
            var points = this.getLatLngs();
            var marker = L.marker(latLng, {
                draggable: true,
                icon: this.pointIcon
            });

            marker.context = null;

            marker.newPointMarker = null;
            // marker.on('dragstart', function(event) {
            //     var pointNo = that._getPointNo(event.target);
            //     var previousPoint = pointNo == null ? null : that._markers[pointNo - 1].getLatLng();
            //     var nextPoint = pointNo < that._markers.length - 1 ? that._markers[pointNo + 1].getLatLng() : null;
            //     that._setupDragLines(marker, previousPoint, nextPoint);
            //     that._setBusy(true);
            //     that._hideAll(marker);
            // });
            // marker.on('dragend', function(event) {
            //     var marker = event.target;
            //     var pointNo = that._getPointNo(event.target);
            //     that._setBusy(false);
            //     that._reloadPolyline(pointNo);
            // });
            marker.on('contextmenu', function(event) {
                var marker = event.target;
                var pointNo = that._getPointNo(event.target);
                that._map.removeLayer(marker);
                that._map.removeLayer(newPointMarker);
                that._markers.splice(pointNo, 1);
                that._reloadPolyline(pointNo);
            });
            marker.on('click', function(event) {
                console.log('Marker Click')
                var marker = event.target;
                console.log(marker)
                var pointNo = that._getPointNo(event.target);
                if (pointNo == 0 || pointNo == that._markers.length - 1) {
                    // if(PSV != null){
                    //     PSV.destroy();

                    //  }
                    PSV.destroy();
                    loc.setLatLng([marker._latlng.lat, marker._latlng.lng]).update();

                }
                PSV.destroy();
                loc.setLatLng([marker._latlng.lat, marker._latlng.lng]).update();
                var i = 0;

                PSV = new PhotoSphereViewer({
                    container: 'photosphere',
                    panorama: DATAPOINTS[marker.context.originalPolylineNo].data[marker.context.originalPointNo].url,
                    caption: DATAPOINTS[marker.context.originalPolylineNo].data[marker.context.originalPointNo].url,
                    loading_img: 'assets/photosphere-logo.gif',
                    // longitude_range: [-7 * Math.PI / 8, 7 * Math.PI / 8],
                    // latitude_range: [-3 * Math.PI / 4, 3 * Math.PI / 4],
                    anim_speed: '-2rpm',
                    default_fov: 50,
                    fisheye: true,
                    move_speed: 1.1,
                    time_anim: false,
                    //    touchmove_two_fingers: true,
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
                                console.log(e);
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

                                    console.log(i);
                                    loading = false;
                                    PSV.clearMarkers();

                                    PSV.setPanorama(panos[i].url, panos[i].target, false)
                                        .then(function() {
                                            console.log('pressed')
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
                                    console.log(i);
                                    loading = false;
                                    PSV.clearMarkers();

                                    PSV.setPanorama(panos[i].url, panos[i].target, false)
                                        .then(function() {
                                            console.log('pressed')
                                            PSV.setCaption(panos[i].desc);
                                            loading = false;
                                        });
                                }
                            }())
                        },
                        'caption', 'gyroscope', 'stereo', 'fullscreen'
                    ],

                });
            });

            var previousPoint = points[pointNo == 0 ? pointNo : pointNo - 1];
            var newPointMarker = L.marker([(latLng.lat + previousPoint.lat) / 2.,
                (latLng.lng + previousPoint.lng) / 2.
            ], {
                draggable: true,
                icon: this.newPointIcon
            });
            marker.newPointMarker = newPointMarker;
            // newPointMarker.on('dragstart', function(event) {
            //     var pointNo = that._getPointNo(event.target);
            //     var previousPoint = that._markers[pointNo - 1].getLatLng();
            //     var nextPoint = that._markers[pointNo].getLatLng();
            //     that._setupDragLines(marker.newPointMarker, previousPoint, nextPoint);

            //     that._setBusy(true);
            //     that._hideAll(marker.newPointMarker);
            // });
            // newPointMarker.on('dragend', function(event) {
            //     var marker = event.target;
            //     var pointNo = that._getPointNo(event.target);
            //     that._addMarkers(pointNo, marker.getLatLng(), true);
            //     that._setBusy(false);
            //     that._reloadPolyline();
            // });
            newPointMarker.on('contextmenu', function(event) {
                console.log('TODO: split');
                // 1. Remove this polyline from map
                var marker = event.target;
                var pointNo = that._getPointNo(marker);
                var markers = that.getPoints();
                that._hideAll();

                var secondPartMarkers = that._markers.slice(pointNo, pointNo.length);
                that._markers.splice(pointNo, that._markers.length - pointNo);

                that._reloadPolyline();

                var points = [];
                var contexts = [];
                for (var i = 0; i < secondPartMarkers.length; i++) {
                    var marker = secondPartMarkers[i];
                    points.push(marker.getLatLng());
                    contexts.push(marker.context);
                }

                console.log('points:' + points);
                console.log('contexts:' + contexts);

                var newPolyline = L.Polyline.PolylineEditor(points, that._options, contexts)
                    .addTo(that._map);

                that._showBoundMarkers();

                console.log('Done split, _editablePolylines now:' + that._map._editablePolylines.length);
            });

            this._markers.splice(pointNo, 0, marker);

            if (fixNeighbourPositions) {
                this._fixNeighbourPositions(pointNo);
            }

            return marker;
        };

        /**
         * Event handlers for first and last point.
         */
        this._prepareForNewPoint = function(marker, pointNo) {
            that._hideAll();
            that._setupDragLines(marker, marker.getLatLng());
            var mouseMoveHandler = function(event) {
                that._setBusy(true);
            };
            that._map.on('mousemove', mouseMoveHandler);
            that._map.once('click', function(event) {
                console.log('dodajemo na ' + pointNo + ' - ' + event.latlng);
                that._map.off('mousemove', mouseMoveHandler);
                that._addMarkers(pointNo, event.latlng, true);
                that._setBusy(false);
                that._reloadPolyline();
            });
        };

        /**
         * Fix nearby new point markers when the new point is created.
         */
        this._fixNeighbourPositions = function(pointNo) {
            var previousMarker = pointNo == 0 ? null : this._markers[pointNo - 1];
            var marker = this._markers[pointNo];
            var nextMarker = pointNo < this._markers.length - 1 ? this._markers[pointNo + 1] : null;
            if (marker && previousMarker) {
                marker.newPointMarker.setLatLng([(previousMarker.getLatLng().lat + marker.getLatLng().lat) / 2.,
                    (previousMarker.getLatLng().lng + marker.getLatLng().lng) / 2.
                ]);
            }
            if (marker && nextMarker) {
                nextMarker.newPointMarker.setLatLng([(marker.getLatLng().lat + nextMarker.getLatLng().lat) / 2.,
                    (marker.getLatLng().lng + nextMarker.getLatLng().lng) / 2.
                ]);
            }
        };

        /**
         * Find the order number of the marker.
         */
        this._getPointNo = function(marker) {
            for (var i = 0; i < this._markers.length; i++) {
                if (marker == this._markers[i] || marker == this._markers[i].newPointMarker) {
                    return i;
                }
            }
            return -1;
        };

        /**
         * Get polyline latLngs based on marker positions.
         */
        this._getMarkerLatLngs = function() {
            var result = [];
            for (var i = 0; i < this._markers.length; i++)
                result.push(this._markers[i].getLatLng());
            return result;
        };

        this._setupDragLines = function(marker, point1, point2) {
            var line1 = null;
            var line2 = null;
            if (point1) line1 = L.polyline([marker.getLatLng(), point1], {
                    dasharray: "5,1",
                    weight: 1
                })
                .addTo(that._map);
            if (point2) line2 = L.polyline([marker.getLatLng(), point1], {
                    dasharray: "5,1",
                    weight: 1
                })
                .addTo(that._map);

            var moveHandler = function(event) {
                if (line1)
                    line1.setLatLngs([event.latlng, point1]);
                if (line2)
                    line2.setLatLngs([event.latlng, point2]);
            };

            var stopHandler = function(event) {
                that._map.off('mousemove', moveHandler);
                marker.off('dragend', stopHandler);
                if (line1) that._map.removeLayer(line1);
                if (line2) that._map.removeLayer(line2);
                console.log('STOPPED');
                if (event.target != that._map) {
                    that._map.fire('click', event);
                }
            };

            that._map.on('mousemove', moveHandler);
            marker.on('dragend', stopHandler);

            that._map.once('click', stopHandler);
            marker.once('click', stopHandler);
            if (line1) line1.once('click', stopHandler);
            if (line2) line2.once('click', stopHandler);
        }
    }
});

L.Polyline.polylineEditor.addInitHook(function() {
    // Hack to keep reference to map:
    this.originalAddTo = this.addTo;
    this.addTo = function(map) {
        this.originalAddTo(map);
        this._map = map;

        this._addMethods();

        /**
         * When addint a new point we must disable the user to mess with other 
         * markers. One way is to check everywhere if the user is busy. The 
         * other is to just remove other markers when the user is doing 
         * somethinng.
         *
         * TODO: Decide the right way to do this and then leave only _busy or 
         * _hideAll().
         */
        this._busy = false;
        this._initialized = false;

        this._init(this._options, this._contexts);

        this._initialized = true;

        return this;
    };
});

/**
 * Construct a new editable polyline.
 *
 * latlngs  ... a list of points (or two-element tuples with coordinates)
 * options  ... polyline options
 * contexts ... custom contexts for every point in the polyline. Must have the 
 *              same number of elements as latlngs and this data will be 
 *              preserved when new points are added or polylines splitted.
 *
 * TODO: contexts:
 * This is an array of objects that will be kept as "context" for every 
 * point. Marker will keep this value as marker.context. New markers will 
 * have context set to null.
 *
 * Contexts must be the same size as the polyline size!
 *
 * By default, even without calling this method -- every marker will have 
 * context with one value: marker.context.originalPointNo with the 
 * original order number of this point. The order may change if some 
 * markers before this one are delted or new added.
 */
L.Polyline.PolylineEditor = function(latlngs, options, contexts) {
    var result = new L.Polyline.polylineEditor(latlngs, options);
    result._options = options;
    result._contexts = contexts;
    return result;
};