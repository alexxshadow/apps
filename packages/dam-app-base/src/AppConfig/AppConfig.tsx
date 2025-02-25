import * as React from "react";

import {
  AppExtensionSDK,
  CollectionResponse,
} from "@contentful/app-sdk";
import {
  Heading,
  Paragraph,
  Note,
  Typography,
  TextField,
  Form,
  SelectField,
  Option,
  TextLink,
} from "@contentful/forma-36-react-components";
import tokens from "@contentful/forma-36-tokens";
import { css } from "@emotion/css";

import FieldSelector from "./FieldSelector";

import { toInputParameters, toExtensionParameters } from "./parameters";

import {
  getCompatibleFields,
  editorInterfacesToSelectedFields,
  selectedFieldsToTargetState,
  EditorInterface,
  ContentType,
  CompatibleFields,
  SelectedFields,
} from "./fields";

import { Config, ParameterDefinition, ValidateParametersFn } from "../interfaces";

interface Props {
  sdk: AppExtensionSDK;
  parameterDefinitions: ParameterDefinition[];
  validateParameters: ValidateParametersFn;
  logo: string;
  name: string;
  color: string;
  description: string;
}

interface State {
  contentTypes: ContentType[];
  compatibleFields: CompatibleFields;
  selectedFields: SelectedFields;
  parameters: Config;
}

const styles = {
  body: css({
    height: "auto",
    minHeight: "65vh",
    margin: "0 auto",
    marginTop: tokens.spacingXl,
    padding: `${tokens.spacingXl} ${tokens.spacing2Xl}`,
    maxWidth: tokens.contentWidthText,
    backgroundColor: tokens.colorWhite,
    zIndex: 2,
    boxShadow: "0px 0px 20px rgba(0, 0, 0, 0.1)",
    borderRadius: "2px",
  }),
  background: (color: string) =>
    css({
      display: "block",
      position: "absolute",
      zIndex: -1,
      top: 0,
      width: "100%",
      height: "300px",
      backgroundColor: color,
    }),
  section: css({
    margin: `${tokens.spacingXl} 0`,
  }),
  splitter: css({
    marginTop: tokens.spacingL,
    marginBottom: tokens.spacingL,
    border: 0,
    height: "1px",
    backgroundColor: tokens.gray300,
  }),
  icon: css({
    display: "flex",
    justifyContent: "center",
    "> img": {
      display: "block",
      width: "70px",
      margin: `${tokens.spacingXl} 0`,
    },
  }),
};

export default class AppConfig extends React.Component<Props, State> {
  state = {
    contentTypes: [] as ContentType[],
    compatibleFields: ({} as any) as CompatibleFields,
    selectedFields: ({} as any) as SelectedFields,
    parameters: toInputParameters(this.props.parameterDefinitions, null),
  };

  componentDidMount() {
    this.init();
  }

  init = async () => {
    const { space, app, ids } = this.props.sdk;

    app.onConfigure(this.onAppConfigure);

    const [contentTypesResponse, eisResponse, parameters] = await Promise.all([
      space.getContentTypes() as Promise<CollectionResponse<ContentType>>,
      space.getEditorInterfaces(),
      app.getParameters(),
    ]);

    const contentTypes = (contentTypesResponse as CollectionResponse<
      ContentType
    >).items;
    const editorInterfaces = (eisResponse as CollectionResponse<
      EditorInterface
    >).items;

    const compatibleFields = getCompatibleFields(contentTypes);
    const filteredContentTypes = contentTypes.filter((ct) => {
      const fields = compatibleFields[ct.sys.id];
      return fields && fields.length > 0;
    });

    this.setState(
      {
        contentTypes: filteredContentTypes,
        compatibleFields,
        selectedFields: editorInterfacesToSelectedFields(
          editorInterfaces,
          ids.app
        ),
        parameters: toInputParameters(
          this.props.parameterDefinitions,
          parameters
        ),
      },
      () => app.setReady()
    );
  };

  onAppConfigure = () => {
    const { parameters, contentTypes, selectedFields } = this.state;
    const error = this.props.validateParameters(parameters);

    if (error) {
      this.props.sdk.notifier.error(error);
      return false;
    }

    return {
      parameters: toExtensionParameters(
        this.props.parameterDefinitions,
        parameters
      ),
      targetState: selectedFieldsToTargetState(contentTypes, selectedFields),
    };
  };

  render() {
    return (
      <>
        <div className={styles.background(this.props.color)} />
        <div className={styles.body}>
          <Typography>
            <Heading>About {this.props.name}</Heading>
            <Paragraph>{this.props.description}</Paragraph>
            <hr className={styles.splitter} />
          </Typography>
          {this.renderApp()}
        </div>
        <div className={styles.icon}>
          <img src={this.props.logo} alt="App logo" />
        </div>
      </>
    );
  }

  onParameterChange = (key: string, e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | React.ChangeEvent<HTMLSelectElement>) => {
    const { value } = e.currentTarget;

    this.setState((state) => ({
      ...state,
      parameters: { ...state.parameters, [key]: value },
    }));
  };

  onSelectedFieldsChange = (selectedFields: SelectedFields) => {
    this.setState({ selectedFields });
  };

  buildSelectField = (key: string, def: Record<string, any>) => {
    const values = def.value.split(",");
    return (
      <SelectField
        labelText={def.name}
        id={key}
        name={key}
        required={def.required}
        helpText={def.description}
        key={key}
        onChange={this.onParameterChange.bind(this, def.id)}
        value={this.state.parameters[def.id]}
      >
        {values.map((currValue: string) => (
          <Option value={currValue} key={currValue}>
            {currValue}
          </Option>
        ))}
      </SelectField>
    );
  };

  renderApp() {
    const {
      contentTypes,
      compatibleFields,
      selectedFields,
      parameters,
    } = this.state;
    const { parameterDefinitions, sdk } = this.props;
    const { ids } = sdk;
    const { space, environment } = ids;

    const hasConfigurationOptions =
      parameterDefinitions && parameterDefinitions.length > 0;
    return (
      <>
        {hasConfigurationOptions && (
          <Typography>
            <Heading>Configuration</Heading>
            <Form>
              {parameterDefinitions.map((def) => {
                const key = `config-input-${def.id}`;
                if (def.type === "List") {
                  return this.buildSelectField(key, def);
                } else {
                  return (
                    <TextField
                      required={def.required}
                      key={key}
                      id={key}
                      name={key}
                      labelText={def.name}
                      textInputProps={{
                        width: def.type === "Symbol" ? "large" : "medium",
                        type: def.type === "Symbol" ? "text" : "number",
                        maxLength: 255,
                      }}
                      helpText={def.description}
                      value={parameters[def.id]}
                      onChange={this.onParameterChange.bind(this, def.id)}
                    />
                  );
                }
              })}
            </Form>
            <hr className={styles.splitter} />
          </Typography>
        )}
        <Typography>
          <Heading>Assign to fields</Heading>
          {contentTypes.length > 0 ? (
            <Paragraph>
              This app can only be used with <strong>JSON object</strong>{" "}
              fields. Select which JSON fields you’d like to enable for this
              app.
            </Paragraph>
          ) : (
            <>
              <Paragraph>
                This app can be used only with <strong>JSON object</strong>{" "}
                fields.
              </Paragraph>
              <Note noteType="warning">
                There are <strong>no content types with JSON object</strong>{" "}
                fields in this environment. You can add one in your{" "}
                <TextLink
                  linkType="primary"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={
                    environment === "master"
                      ? `https://app.contentful.com/spaces/${space}/content_types`
                      : `https://app.contentful.com/spaces/${space}/environments/${environment}/content_types`
                  }
                >
                  content model
                </TextLink>{" "}
                and assign it to the app from this screen.
              </Note>
            </>
          )}
          <FieldSelector
            contentTypes={contentTypes}
            compatibleFields={compatibleFields}
            selectedFields={selectedFields}
            onSelectedFieldsChange={this.onSelectedFieldsChange}
          />
        </Typography>
      </>
    );
  }
}
