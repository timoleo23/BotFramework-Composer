// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import { jsx } from '@emotion/core';
import React, { useState } from 'react';
import formatMessage from 'format-message';
import { Dialog, DialogFooter, DialogType } from 'office-ui-fabric-react/lib/Dialog';
import { DefaultButton, PrimaryButton } from 'office-ui-fabric-react/lib/Button';
import { JSONSchema7 } from '@bfc/extension-client';
import { Link } from 'office-ui-fabric-react/lib/components/Link';
import { useRecoilValue } from 'recoil';
import { SkillManifestFile } from '@bfc/shared';
import { navigate } from '@reach/router';

import {
  dispatcherState,
  skillManifestsState,
  qnaFilesSelectorFamily,
  dialogsSelectorFamily,
  dialogSchemasState,
  currentTargetState,
  luFilesSelectorFamily,
  settingsState,
  rootBotProjectIdSelector,
} from '../../../recoilModel';

import { styles } from './styles';
import { generateSkillManifest } from './generateSkillManifest';
import { editorSteps, ManifestEditorSteps, order, VERSION_REGEX } from './constants';
import { mergePropertiesManagedByRootBot } from '../../../recoilModel/dispatchers/utils/project';
import { cloneDeep } from 'lodash';

interface ExportSkillModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  onSubmit: () => void;
  projectId: string;
}

const ExportSkillModal: React.FC<ExportSkillModalProps> = ({ onSubmit, onDismiss: handleDismiss, projectId }) => {
  const dialogs = useRecoilValue(dialogsSelectorFamily(projectId));
  const dialogSchemas = useRecoilValue(dialogSchemasState(projectId));
  const currentTarget = useRecoilValue(currentTargetState(projectId));
  const luFiles = useRecoilValue(luFilesSelectorFamily(projectId));
  const qnaFiles = useRecoilValue(qnaFilesSelectorFamily(projectId));
  const skillManifests = useRecoilValue(skillManifestsState(projectId));
  const { updateSkillManifest } = useRecoilValue(dispatcherState);

  const [currentStep, setCurrentStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [schema, setSchema] = useState<JSONSchema7>({});

  const [skillManifest, setSkillManifest] = useState<Partial<SkillManifestFile>>({});
  const { content = {}, id } = skillManifest;

  const [selectedDialogs, setSelectedDialogs] = useState<any[]>([]);
  const [selectedTriggers, setSelectedTriggers] = useState<any[]>([]);

  const editorStep = order[currentStep];
  const { buttons = [], content: Content, editJson, helpLink, subText, title, validate } = editorSteps[editorStep];

  const settings = useRecoilValue(settingsState(projectId));
  const rootBotProjectId = useRecoilValue(rootBotProjectIdSelector) || '';
  const mergedSettings = mergePropertiesManagedByRootBot(projectId, rootBotProjectId, settings);
  const { skillConfiguration } = mergedSettings;
  const { setSettings } = useRecoilValue(dispatcherState);
  const [callers, setCallers] = useState<string[]>(skillConfiguration?.allowedCallers ?? []);

  const updateAllowedCallers = React.useCallback(
    (allowedCallers: string[] = []) => {
      const updatedSetting = {
        ...cloneDeep(mergedSettings),
        skillConfiguration: { ...skillConfiguration, allowedCallers },
      };
      setSettings(projectId, updatedSetting);
    },
    [mergedSettings, projectId, skillConfiguration]
  );

  const handleGenerateManifest = () => {
    const manifest = generateSkillManifest(
      schema,
      skillManifest,
      dialogs,
      dialogSchemas,
      luFiles,
      qnaFiles,
      selectedTriggers,
      selectedDialogs,
      currentTarget,
      projectId
    );
    setSkillManifest(manifest);
    if (manifest.content && manifest.id) {
      updateSkillManifest(manifest as SkillManifestFile, projectId);
    }
  };

  const handleEditJson = () => {
    const step = order.findIndex((step) => step === ManifestEditorSteps.MANIFEST_REVIEW);
    if (step >= 0) {
      setCurrentStep(step);
      setErrors({});
    }
  };

  const handleTriggerPublish = async () => {
    const filePath = `https://${JSON.parse(currentTarget.configuration).hostname}.azurewebsites.net/manifests/${
      skillManifest.id
    }.json`;
    navigate(`/bot/${projectId}/publish/all?publishTargetName=${currentTarget.name}&url=${filePath}`);
  };

  const handleSave = () => {
    const manifest = generateSkillManifest(
      schema,
      skillManifest,
      dialogs,
      dialogSchemas,
      luFiles,
      qnaFiles,
      selectedTriggers,
      selectedDialogs,
      currentTarget,
      projectId
    );
    if (manifest.content && manifest.id) {
      updateSkillManifest(manifest as SkillManifestFile, projectId);
    }
  };

  const onSaveSkill = () => {
    updateAllowedCallers(callers);
  };

  const handleNext = (options?: { dismiss?: boolean; id?: string; save?: boolean }) => {
    const validated = typeof validate === 'function' ? validate({ content, id, schema, skillManifests }) : errors;

    if (!Object.keys(validated).length) {
      setCurrentStep((current) => {
        if (current === 1) {
          const [version] = VERSION_REGEX.exec(content.$schema) || [];
          if (current + 1 === order.length) {
            return current;
          } else {
            return version === '2.0.0' ? current + 2 : current + 1;
          }
        } else {
          return current + 1 < order.length ? current + 1 : current;
        }
      });
      options?.save && handleSave();
      options?.dismiss && handleDismiss();
      setErrors({});
    } else {
      setErrors(validated);
    }
  };

  return (
    <Dialog
      dialogContentProps={{
        type: DialogType.close,
        title: title(),
        styles: styles.dialog,
      }}
      hidden={false}
      modalProps={{
        isBlocking: false,
        styles: styles.modal,
      }}
      onDismiss={handleDismiss}
    >
      <div css={styles.container}>
        <p>
          {typeof subText === 'function' && subText()}
          {helpLink && (
            <React.Fragment>
              {!!subText && <React.Fragment>&nbsp;</React.Fragment>}
              <Link href={helpLink} rel="noopener noreferrer" target="_blank">
                {formatMessage('Learn more')}
              </Link>
            </React.Fragment>
          )}
        </p>
        <div
          css={{
            ...styles.content,
            overflow: order[currentStep] === ManifestEditorSteps.MANIFEST_DESCRIPTION ? 'auto' : 'hidden',
          }}
        >
          <Content
            completeStep={handleNext}
            editJson={handleEditJson}
            errors={errors}
            manifest={skillManifest}
            projectId={projectId}
            schema={schema}
            setErrors={setErrors}
            setSchema={setSchema}
            setSelectedDialogs={setSelectedDialogs}
            setSelectedTriggers={setSelectedTriggers}
            setSkillManifest={setSkillManifest}
            skillManifests={skillManifests}
            value={content}
            callers={callers}
            setCallers={setCallers}
            onChange={(manifestContent) => setSkillManifest({ ...skillManifest, content: manifestContent })}
          />
        </div>
        <DialogFooter>
          <div css={styles.buttonContainer}>
            <div>
              {buttons.map(({ disabled, primary, text, onClick }, index) => {
                const Button = primary ? PrimaryButton : DefaultButton;
                const isDisabled = typeof disabled === 'function' ? disabled({ manifest: skillManifest }) : !!disabled;

                return (
                  <Button
                    key={index}
                    disabled={isDisabled}
                    styles={{ root: { marginLeft: '8px' } }}
                    text={text()}
                    onClick={onClick({
                      generateManifest: handleGenerateManifest,
                      setCurrentStep,
                      manifest: skillManifest,
                      onDismiss: handleDismiss,
                      onNext: handleNext,
                      onSave: handleSave,
                      onPublish: handleTriggerPublish,
                      onSubmit,
                      onSaveSkill,
                    })}
                  />
                );
              })}
            </div>
            {editJson && <DefaultButton text={formatMessage('Edit in JSON')} onClick={handleEditJson} />}
          </div>
        </DialogFooter>
      </div>
    </Dialog>
  );
};

export default ExportSkillModal;
