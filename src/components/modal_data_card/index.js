import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Card from "@material-ui/core/Card";
import CardContent from "@material-ui/core/CardContent";
import CardMedia from "@material-ui/core/CardMedia";
import Typography from "@material-ui/core/Typography";
import CustomizedSteppers from "./../stepper";
import EventIcon from "@material-ui/icons/Event";
import PinDropIcon from "@material-ui/icons/PinDrop";
import SeverityIndicator from "./../severity_indicator";
import HeaderTextCard from "./../header_text_card";
import Comments from "./../comments";
import "./css/modal_data_card.css";

const useStyles = makeStyles({
  root: {
    maxWidth: 700,
  },
  media: {
    height: 140,
  },
  mediaMap: {
    height: 200,
  },
  headerTextColor: {
    color: "white",
  },
});

export default function DetailedDataCard(props) {
  const classes = useStyles();
  const mapUrl =
    "https://www.openstreetmap.org/export/embed.html?bbox=" +
    (props.data.longitude - 0.01) +
    "%2C" +
    (props.data.latitude - 0.01) +
    "%2C" +
    (props.data.longitude + 0.01) +
    "%2C" +
    (props.data.latitude + 0.01) +
    "&layer=mapnik&marker=" +
    props.data.latitude +
    "%2C" +
    props.data.longitude;
  const openStreetMapUrl =
    "https://www.openstreetmap.org/?mlat=" +
    props.data.latitude +
    "&mlon=" +
    props.data.longitude +
    "#map=15/" +
    props.data.latitude +
    "/" +
    props.data.longitude;

  return (
    <Card
      style={{ border: "2px solid rgba(255,255,255,0.1)" }}
      className={classes.root}
    >
      <CardMedia className={classes.media} image={props.data.imageURL} />
      <CardContent>
        <Typography gutterBottom variant="h5" component="h2"></Typography>
        <Typography variant="body2" color="textSecondary" component="p">
          <Typography gutterBottom>
            <EventIcon />
            &nbsp; &nbsp; {props.data.dateTime}
          </Typography>

          <br />
          <Typography gutterBottom>
            <PinDropIcon />
            &nbsp; &nbsp; {props.data.fullLocation}
          </Typography>

          <br />
          <HeaderTextCard
            text="Severity Rate"
            marginBottom="40px"
            color={classes.headerTextColor.color}
          />
          <SeverityIndicator value={props.data.severity} />

          <br />
          <HeaderTextCard
            text="Status"
            marginBottom="15px"
            color={classes.headerTextColor.color}
          />
          <CustomizedSteppers stepNumber={props.data.stepNumber} />

          <p style={{ marginTop: "120px", textAlign: "justify" }}>
            <hr style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }} />
            <HeaderTextCard
              text="Complaint Description"
              marginBottom="15px"
              color={classes.headerTextColor.color}
            />
            {props.data.fullDescription}
          </p>
          <br />
          <div style={{ marginTop: "20px" }}>
            <iframe
              title="OpenStreetMap preview"
              src={mapUrl}
              style={{
                width: "100%",
                height: "200px",
                border: "0",
                borderRadius: "8px",
              }}
            />
            <div style={{ marginTop: "8px" }}>
              <a href={openStreetMapUrl} target="_blank" rel="noreferrer">
                Open in OpenStreetMap
              </a>
            </div>
          </div>
          <br />
          <hr style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }} />

          <HeaderTextCard
            text="Comments"
            marginBottom="15px"
            color={classes.headerTextColor.color}
          />
          <Comments caseNumber={props.data.caseNumber} />
        </Typography>
      </CardContent>
    </Card>
  );
}
