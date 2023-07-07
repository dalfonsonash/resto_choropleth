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
d3.json("https://data.sfgov.org/resource/pyih-qa8i.json").then(function(data) {
  // Filter out businesses without zip codes or inspection scores
  let filteredData = data.filter(item => item.business_postal_code && item.inspection_score);

  // Create an object to hold the inspection scores for each zip code
  let inspectionScores = {};

  // Iterate over the filtered data and store inspection scores by zip code
  filteredData.forEach(item => {
    let zipCode = item.business_postal_code;
    let inspectionScore = parseFloat(item.inspection_score);

    // Check if the zip code exists in the inspectionScores object
    if (zipCode in inspectionScores) {
      inspectionScores[zipCode].push(inspectionScore);
    } else {
      inspectionScores[zipCode] = [inspectionScore];
    }
  });

  // D3 to get the JSON data
  d3.json("https://data.sfgov.org/resource/srq6-hmpi.json").then(function(jsonData) {
    // Convert JSON data to GeoJSON format
    let geojson = {
      type: "FeatureCollection",
      features: jsonData.map(item => {
        return {
          type: "Feature",
          properties: item,
          geometry: {
            type: "Polygon",
            coordinates: item.geometry.coordinates
          }
        };
      })
    };

    // Iterate over the geojson features and calculate the average inspection score for each zip code
    geojson.features.forEach(feature => {
      let zipCode = feature.properties.zip_code || feature.properties.zip; // Check both "zip_code" and "zip" properties

      // Check if the zip code exists in the inspectionScores object
      if (zipCode in inspectionScores) {
        let scores = inspectionScores[zipCode];

        if (scores && scores.length > 0) {
          let sum = scores.reduce((acc, cur) => acc + cur, 0);
          let average = Math.floor(sum / scores.length);
          inspectionScores[zipCode] = average;
        } else {
          inspectionScores[zipCode] = undefined; // No inspection scores for the zip code
        }
      } else {
        inspectionScores[zipCode] = undefined; // No inspection scores for the zip code
      }
    });

    // Create the choropleth layer using L.choropleth
    let choroplethLayer = L.choropleth(geojson, {
      valueProperty: feature => {
        let zipCode = feature.properties.zip_code || feature.properties.zip; // Check both "zip_code" and "zip" properties
        return inspectionScores[zipCode] || 0;
      },
      scale: ["gray", "red", "#FFFF00", "#008000"],
      steps: 4,
      mode: "q",
      style: {
        color: "blue",
        weight: 0.5,
        fillOpacity: 0.7
      },
      onEachFeature: (feature, layer) => {
        let zipCode = feature.properties.zip_code || feature.properties.zip; // Check both "zip_code" and "zip" properties
        let score = inspectionScores[zipCode];
        let popupContent = "SF Public Health Data"+"<br>"+"Zip Code: " + zipCode + "<br>";

        if (score !== undefined) {
          popupContent += "Average Inspection Score: " + score.toFixed(0);
        } else {
          popupContent += "No data";
        }

        layer.bindPopup(popupContent);
      }
    }).addTo(myMap);

    // Set up the legend.
// Set up the legend.

var legend = L.control({ position: "bottomright" });
legend.onAdd = function() {
  var div = L.DomUtil.create("div", "legend");
  var limits = ["No Data", "Eat at Your Own Peril", "Needs Improvement", "Definitely No Tummy Aches"];
  var colors = ["gray", "red", "#FFFF00", "#008000"];
  let labels = [];

  // Add the legend title.
  div.innerHTML += '<h4>SF Public Health Inspection Scores</h4>';

  // Create the legend color bar.
for (var i = 0; i < limits.length; i++) {
  var colorRange;
  if (i === 0) {
    colorRange = "No Data";
  } else if (i === 1) {
    colorRange = "Eat at Your Own Peril";
  } else if (i === 2) {
    colorRange = "Needs Improvement";
  } else if (i === 3) {
    colorRange = "Definitely No Tummy Aches";
  }
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
  
  })
  .catch(function(error) {
    console.error('Error fetching JSON data:', error);
  });
});

