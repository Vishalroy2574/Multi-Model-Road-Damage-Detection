import React from "react";
import TextField from "@material-ui/core/TextField";
import Autocomplete from "@material-ui/lab/Autocomplete";
import LocationOnIcon from "@material-ui/icons/LocationOn";
import Grid from "@material-ui/core/Grid";
import Typography from "@material-ui/core/Typography";
import { makeStyles } from "@material-ui/core/styles";
import parse from "autosuggest-highlight/parse";
import throttle from "lodash/throttle";
import axios from "axios";
import { Chip } from "@material-ui/core";
import AddLocationIcon from "@material-ui/icons/AddLocation";

const nominatim = axios.create({
  baseURL: "https://nominatim.openstreetmap.org",
  headers: {
    Accept: "application/json",
  },
});

const useStyles = makeStyles((theme) => ({
  icon: {
    color: theme.palette.text.secondary,
    marginRight: theme.spacing(2),
  },
  textInput: {
    marginBottom: "10px",
  },
  labelText: {
    marginTop: "25px",
    marginBottom: "10px",
  },
  buttonCurrentLocation: {
    marginBottom: "15px",
  },
}));

export default function LocationSearchInput(props) {
  const classes = useStyles();
  const [inputValue, setInputValue] = React.useState("");
  const [options, setOptions] = React.useState([]);
  const [errorRequired, updateRequired] = React.useState(false);
  const [currentLocation] = React.useState("");
  const [currentLatLngValue] = React.useState("");

  const fetch = React.useMemo(
    () =>
      throttle((request, callback) => {
        nominatim
          .get("/search", {
            params: {
              format: "jsonv2",
              limit: 5,
              q: request.input,
            },
          })
          .then((res) => {
            callback(
              (res.data || []).map((item) => ({
                description: item.display_name,
                place_id: String(item.place_id),
                structured_formatting: {
                  main_text: item.display_name.split(",")[0],
                  secondary_text: item.display_name,
                  main_text_matched_substrings: [
                    { offset: 0, length: item.display_name.split(",")[0].length },
                  ],
                },
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
              }))
            );
          })
          .catch(() => callback([]));
      }, 200),
    []
  );

  React.useEffect(() => {
    let active = true;

    if (inputValue === "") {
      setOptions([]);
      return undefined;
    }

    fetch({ input: inputValue }, (results) => {
      if (active) {
        setOptions(results || []);
      }
    });

    return () => {
      active = false;
    };
  }, [inputValue, fetch]);

  const handleChange = (event) => {
    setInputValue(event.target.value);
    if (event.target.value.trim() !== "") {
      updateRequired(false);
    } else {
      updateRequired(true);
    }

    if (event.target.value.trim() === "") {
      if (props.currentLocationOptional === undefined) {
        props.updateLocation(currentLocation, currentLatLngValue);
      }
    }
  };

  const handleAutoChange = (event, value) => {
    if (!value) {
      props.updateLocation(currentLocation, currentLatLngValue);
      return;
    }

    props.updateLocation(value.description, { lat: value.lat, lng: value.lng });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(function (position) {
      nominatim
        .get("/reverse", {
          params: {
            format: "jsonv2",
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          },
        })
        .then((res) => {
          props.updateLocation(
            (res.data && res.data.display_name) || "Current location",
            {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            }
          );
        })
        .catch(() => {
          props.updateLocation("Current location", {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        });
    });
  };

  return (
    <div>
      <Typography gutterBottom className={classes.labelText}>
        {props.label || "Tag Pothole's Location"}
      </Typography>
      <Autocomplete
        id="location-search-demo"
        getOptionLabel={(option) =>
          typeof option === "string" ? option : option.description
        }
        filterOptions={(x) => x}
        options={options}
        autoComplete
        includeInputInList
        disableOpenOnFocus
        fullWidth
        onChange={handleAutoChange}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Add a location"
            variant="outlined"
            fullWidth
            className={classes.textInput}
            onChange={handleChange}
          />
        )}
        renderOption={(option) => {
          const mainText = option.structured_formatting.main_text;
          const parts = parse(mainText, [
            [0, mainText.length],
          ]);

          return (
            <Grid container alignItems="center">
              <Grid item>
                <LocationOnIcon className={classes.icon} />
              </Grid>
              <Grid item xs>
                {parts.map((part, index) => (
                  <span
                    key={index}
                    style={{ fontWeight: part.highlight ? 700 : 400 }}
                  >
                    {part.text}
                  </span>
                ))}

                <Typography variant="body2" color="textSecondary">
                  {option.structured_formatting.secondary_text}
                </Typography>
              </Grid>
            </Grid>
          );
        }}
      />
      {props.currentLocationOptional === undefined && (
        <div>
          <h5
            style={{ color: "white", textAlign: "center", fontWeight: "bold" }}
          >
            OR
          </h5>
          <div style={{ textAlign: "center" }}>
            <i>(Will Use Current Location Instead)</i>
          </div>
          <div style={{ textAlign: "center" }}>
            <Chip
              style={{ marginBottom: "25px", marginTop: "7px" }}
              icon={<AddLocationIcon />}
              label="Use Current Location"
              onClick={useCurrentLocation}
            />
          </div>
        </div>
      )}
    </div>
  );
}
