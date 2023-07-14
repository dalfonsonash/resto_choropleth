// Create the Leaflet map
let myMap = L.map("map", {
  center: [37.7749, -122.4194],
  zoom: 13
});

// Adding the tile layer
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
}).addTo(myMap);

// D3 to get the JSON data
d3.json("https://data.sfgov.org/resource/6ia5-2f8k.json").then(function(neighborhoodData) {
  // Convert JSON data to GeoJSON format
  let geojson = {
    type: "FeatureCollection",
    features: neighborhoodData.map(item => {
      return {
        type: "Feature",
        properties: {
          name: item.name,
          coordinates: item.the_geom.coordinates
        },
        geometry: {
          type: "MultiPolygon",
          coordinates: item.the_geom.coordinates
        }
      };
      console.log(geojson)
    })
  };

  // D3 to get the JSON data
  d3.json("https://data.sfgov.org/resource/pyih-qa8i.json").then(function(inspectionData) {
    // Create an object to hold the inspection scores for each neighborhood
    let inspectionScores = {};

    // Group inspection scores by neighborhood
    inspectionData.forEach(item => {
      if (item.business_location && item.inspection_score !== undefined) {
        let businessCoordinates = item.business_location.coordinates;
        let inspectionScore = parseFloat(item.inspection_score);

        // Check if the business coordinates fall within any neighborhood's coordinates
        let neighborhood = geojson.features.find(feature =>
          turf.booleanPointInPolygon(turf.point(businessCoordinates), feature.geometry)
        );

        if (neighborhood) {
          let neighborhoodCoordinates = JSON.stringify(neighborhood.geometry.coordinates);

          if (neighborhoodCoordinates in inspectionScores) {
            inspectionScores[neighborhoodCoordinates].push(inspectionScore);
          } else {
            inspectionScores[neighborhoodCoordinates] = [inspectionScore];
          }
        }
      }
    });

   // Iterate over the geojson features and calculate the average inspection score for each neighborhood
geojson.features.forEach(feature => {

  let coordinates = JSON.stringify(feature.geometry.coordinates);

  // Check if the coordinates exist in the inspectionScores object
  if (coordinates in inspectionScores) {
    let scores = inspectionScores[coordinates];
    let numericScores = scores.map(score => parseFloat(score)); // Convert scores to numbers
    let average = Math.round(numericScores.reduce((total, score) => total + score, 0) / numericScores.length);
    feature.properties.average_inspection_score = average;
  } else {
    feature.properties.average_inspection_score = undefined;
  }
});

// Create the choropleth layer using L.choropleth
let choroplethLayer = L.choropleth(geojson, {
  valueProperty: "average_inspection_score",
  scale: 'viridis', // Gray, Red, Yellow, Green for the color scale
  steps: 7,
  mode: "q",
  style: function(feature) {
    const score = feature.properties.average_inspection_score;

    if (score >= 65 && score <= 100) {
      // Use the 'viridis' scale for scores between 65 and 100
      return {
        color: "black",
        fillColor: score,
        weight: 1,
        fillOpacity: 0.5
      };
    } else {
      // Assign gray color to scores outside the range
      return {
        color: "black",
        fillColor: "#808080",
        weight: 1,
        fillOpacity: 0.5
      };
    }
  },
  onEachFeature: function(feature, layer) {
    let neighborhood = feature.properties.name;
    let score = feature.properties.average_inspection_score;
    let popupContent = "Neighborhood: " + neighborhood + "<br>";

    if (score !== undefined) {
      popupContent += "Average Inspection Score: " + (score ? score.toFixed(0) : "No data");
    } else {
      popupContent += "No data";
    }

    layer.bindPopup(popupContent);

    layer.on("click", function() {
      console.log("Feature:", feature); // Log the feature data when clicked on the map
      console.log("Average Inspection Score:", score); // Log the average inspection score
    });
  }
}).addTo(myMap);


// Set up the legend.
var legend = L.control({ position: "topright" });
legend.onAdd = function() {
  var div = L.DomUtil.create("div", "legend");
  var steps = 7; // Number of steps
  var startColor = '#440154'; // Start color (green)
  var middleColor = "#31688E"; // Middle color
  var endColor = "yellow"; // End color (yellow)

  // Generate the color scale using Chroma.js
  var colors = chroma.scale([startColor, middleColor, endColor]).colors(steps);


// Generate the legend based on the colors
  var limits = ["65-70", "70-75", "75-80", "80-85", "85-90", "90-95", "95-100"];

  let labels = [];

  // Add the legend title.
  div.innerHTML += '<h4 style="text-align: center;">SF Public Health Inspection Scores<br><span style="font-size: 14px; font-weight: bold;">by neighborhood</span></h4>';

  // Create the legend color bar.
  for (var i = 0; i < limits.length; i++) {
    var colorRange = limits[i];
    div.innerHTML +=
      '<i style="background:' + colors[i] + '"></i> ' +
      colorRange + '<br>';
  }

  return div;
};

// Adding the legend to the map
legend.addTo(myMap);

// Fit the map bounds to the choropleth layer
myMap.fitBounds(choroplethLayer.getBounds());

  }).catch(function(error) {
    console.error("Error fetching inspection data:", error);
  });
}).catch(function(error) {
  console.error("Error fetching neighborhood data:", error);
});
