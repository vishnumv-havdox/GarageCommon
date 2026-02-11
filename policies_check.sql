SET session_replication_role = replica;

--
-- PostgreSQL database dump
--

-- \restrict Q2Hr4ZzKUDEJr60N052PiRqCyG8bxzPAdHVFclhZSdCBvsgDgaLvgoSHNz52NTY

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: audit_log_entries; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: flow_state; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: users; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."users" ("instance_id", "id", "aud", "role", "email", "encrypted_password", "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current", "email_change_confirm_status", "banned_until", "reauthentication_token", "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous") VALUES
	('00000000-0000-0000-0000-000000000000', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', 'authenticated', 'authenticated', 'vishnu@gmail.com', '$2a$10$B.k23WI60/bkADwGMxBv1.UKgEtb/S7MWKD/B424F0rfvpW58tZoG', '2026-01-21 11:45:20.241718+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-02-09 06:35:20.285898+00', '{"provider": "email", "providers": ["email"]}', '{"email_verified": true}', NULL, '2026-01-21 11:45:20.22076+00', '2026-02-11 05:39:16.656702+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '4a653d0e-92c9-4c58-a80e-44329f9402e4', 'authenticated', 'authenticated', 'ram@gmail.com', '$2a$10$LNkAOravgndbS54p12nAEO781qvlnev5ks/VrdzY9FEBSeQkhf2Wq', '2026-01-22 04:36:29.856717+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-02-11 03:52:31.546127+00', '{"provider": "email", "providers": ["email"]}', '{"name": "ram", "phone": "908776545", "email_verified": true}', NULL, '2026-01-22 04:36:29.818322+00', '2026-02-11 05:48:48.856392+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),
	('00000000-0000-0000-0000-000000000000', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', 'authenticated', 'authenticated', 'tony@gmail.com', '$2a$10$sr/dpQ1r/P50G1/oflzhXeH8bqRGXk64pc3GXDG/7LTbukJr/3Pd2', '2026-01-21 11:59:33.016309+00', NULL, '', NULL, '', NULL, '', '', NULL, '2026-02-09 10:34:43.150627+00', '{"provider": "email", "providers": ["email"]}', '{"name": "tony", "phone": "908776545", "email_verified": true}', NULL, '2026-01-21 11:59:33.010248+00', '2026-02-11 05:57:19.274503+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);


--
-- Data for Name: identities; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."identities" ("provider_id", "user_id", "identity_data", "provider", "last_sign_in_at", "created_at", "updated_at", "id") VALUES
	('01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '{"sub": "01f183b3-82cf-455c-a2dd-c9a22a0e7511", "email": "vishnu@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-21 11:45:20.236455+00', '2026-01-21 11:45:20.236512+00', '2026-01-21 11:45:20.236512+00', 'b8e01a22-026b-4443-ab37-ff455a6df893'),
	('20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{"sub": "20b6700f-a5ce-43bc-ae2a-6af093f13b7e", "email": "tony@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-21 11:59:33.013527+00', '2026-01-21 11:59:33.013583+00', '2026-01-21 11:59:33.013583+00', '6c3a278b-3a69-483b-8222-b42db20d1ddc'),
	('4a653d0e-92c9-4c58-a80e-44329f9402e4', '4a653d0e-92c9-4c58-a80e-44329f9402e4', '{"sub": "4a653d0e-92c9-4c58-a80e-44329f9402e4", "email": "ram@gmail.com", "email_verified": false, "phone_verified": false}', 'email', '2026-01-22 04:36:29.848509+00', '2026-01-22 04:36:29.852445+00', '2026-01-22 04:36:29.852445+00', 'f74b3282-81f5-4ec0-bb12-dc0e30af8e04');


--
-- Data for Name: instances; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_clients; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sessions; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."sessions" ("id", "user_id", "created_at", "updated_at", "factor_id", "aal", "not_after", "refreshed_at", "user_agent", "ip", "tag", "oauth_client_id", "refresh_token_hmac_key", "refresh_token_counter", "scopes") VALUES
	('6e2c92af-65af-4188-8d85-f7c7d02cdd3e', '4a653d0e-92c9-4c58-a80e-44329f9402e4', '2026-02-06 05:49:38.64534+00', '2026-02-06 11:38:02.400272+00', NULL, 'aal1', NULL, '2026-02-06 11:38:02.400168', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '121.200.55.84', NULL, NULL, NULL, NULL, NULL),
	('2c2c0ce6-1cbd-4600-a358-012d7fb4f88c', '4a653d0e-92c9-4c58-a80e-44329f9402e4', '2026-02-10 06:47:34.107556+00', '2026-02-10 12:37:42.115659+00', NULL, 'aal1', NULL, '2026-02-10 12:37:42.114891', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '121.200.55.84', NULL, NULL, NULL, NULL, NULL),
	('218e370b-71d3-4d63-a212-91a89477224f', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-02-09 10:33:31.617852+00', '2026-02-09 10:33:31.617852+00', NULL, 'aal1', NULL, NULL, 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0', '121.200.55.84', NULL, NULL, NULL, NULL, NULL),
	('3d1488a7-e474-44b6-9c50-ac58efcb8438', '4a653d0e-92c9-4c58-a80e-44329f9402e4', '2026-02-05 08:03:36.378503+00', '2026-02-05 11:57:08.024012+00', NULL, 'aal1', NULL, '2026-02-05 11:57:08.02391', 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0', '121.200.55.84', NULL, NULL, NULL, NULL, NULL),
	('98db70ee-681a-48bc-a800-0038b2e84131', '4a653d0e-92c9-4c58-a80e-44329f9402e4', '2026-02-09 10:35:02.841503+00', '2026-02-09 12:31:25.256504+00', NULL, 'aal1', NULL, '2026-02-09 12:31:25.256416', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '121.200.55.84', NULL, NULL, NULL, NULL, NULL),
	('1355a0f5-b355-4726-a5a2-8ec98f0b0afe', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-09 06:35:20.286035+00', '2026-02-11 05:39:16.672003+00', NULL, 'aal1', NULL, '2026-02-11 05:39:16.671875', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '121.200.55.84', NULL, NULL, NULL, NULL, NULL),
	('5d189730-f7c3-4980-a61b-a93de338ac1b', '4a653d0e-92c9-4c58-a80e-44329f9402e4', '2026-02-11 03:52:31.546226+00', '2026-02-11 05:48:48.866584+00', NULL, 'aal1', NULL, '2026-02-11 05:48:48.866467', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36', '121.200.55.84', NULL, NULL, NULL, NULL, NULL),
	('0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-02-09 10:34:43.150724+00', '2026-02-11 05:57:19.28598+00', NULL, 'aal1', NULL, '2026-02-11 05:57:19.285863', 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:147.0) Gecko/20100101 Firefox/147.0', '121.200.55.84', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: mfa_amr_claims; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."mfa_amr_claims" ("session_id", "created_at", "updated_at", "authentication_method", "id") VALUES
	('3d1488a7-e474-44b6-9c50-ac58efcb8438', '2026-02-05 08:03:36.490573+00', '2026-02-05 08:03:36.490573+00', 'password', '1cfc1a0e-43f8-4516-952c-c3dfc8dd2817'),
	('6e2c92af-65af-4188-8d85-f7c7d02cdd3e', '2026-02-06 05:49:38.682784+00', '2026-02-06 05:49:38.682784+00', 'password', '323cf053-f970-4e44-bff1-f091d4fc119c'),
	('1355a0f5-b355-4726-a5a2-8ec98f0b0afe', '2026-02-09 06:35:20.351932+00', '2026-02-09 06:35:20.351932+00', 'password', 'f826974b-e4c2-4f20-9e63-849d7fcb932e'),
	('218e370b-71d3-4d63-a212-91a89477224f', '2026-02-09 10:33:31.6312+00', '2026-02-09 10:33:31.6312+00', 'password', '634a9382-ac8a-44d2-a499-abf0da50bd6d'),
	('0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1', '2026-02-09 10:34:43.242514+00', '2026-02-09 10:34:43.242514+00', 'password', '560e6d8d-64dd-4eee-9a18-93943c2f1818'),
	('98db70ee-681a-48bc-a800-0038b2e84131', '2026-02-09 10:35:02.844861+00', '2026-02-09 10:35:02.844861+00', 'password', '0c538784-f2df-4ba5-948e-230f14cec21a'),
	('2c2c0ce6-1cbd-4600-a358-012d7fb4f88c', '2026-02-10 06:47:34.193891+00', '2026-02-10 06:47:34.193891+00', 'password', 'e188dfaa-f1f9-46b0-8f0d-d97cd87930e7'),
	('5d189730-f7c3-4980-a61b-a93de338ac1b', '2026-02-11 03:52:31.612195+00', '2026-02-11 03:52:31.612195+00', 'password', '3745b7f1-dab8-40a1-9543-36ef6ec9ddac');


--
-- Data for Name: mfa_factors; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: mfa_challenges; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_authorizations; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_client_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: oauth_consents; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: one_time_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--

INSERT INTO "auth"."refresh_tokens" ("instance_id", "id", "token", "user_id", "revoked", "created_at", "updated_at", "parent", "session_id") VALUES
	('00000000-0000-0000-0000-000000000000', 466, 'hhsov6scnvuq', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-09 10:28:18.109744+00', '2026-02-09 11:26:24.524495+00', 'uhrbvs4ughi5', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 469, '2s7ufghqwugp', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', true, '2026-02-09 10:34:43.187522+00', '2026-02-09 11:33:02.040547+00', NULL, '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 470, 'ls6iqpmzjh6o', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-09 10:35:02.84248+00', '2026-02-09 11:33:25.268548+00', NULL, '98db70ee-681a-48bc-a800-0038b2e84131'),
	('00000000-0000-0000-0000-000000000000', 477, 'gntqe2mu22bt', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 03:53:45.951647+00', '2026-02-10 04:51:59.085327+00', 'plytlkkj57p3', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 439, '6w4ijpxuehtk', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-05 10:58:43.062586+00', '2026-02-05 11:57:07.98403+00', 'z5xqmrqrawvh', '3d1488a7-e474-44b6-9c50-ac58efcb8438'),
	('00000000-0000-0000-0000-000000000000', 482, '62dlnrrpmrdu', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-10 07:45:58.354736+00', '2026-02-10 08:44:27.931952+00', 'clmcc57oaavl', '2c2c0ce6-1cbd-4600-a358-012d7fb4f88c'),
	('00000000-0000-0000-0000-000000000000', 483, 'cpiwh4b2cmjz', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 07:46:39.283453+00', '2026-02-10 08:44:56.787162+00', 'ktof6vfiaca2', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 490, 'xxjzypx2uh2w', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-10 10:40:50.827028+00', '2026-02-10 11:39:13.703239+00', 'upq3mlpqcndx', '2c2c0ce6-1cbd-4600-a358-012d7fb4f88c'),
	('00000000-0000-0000-0000-000000000000', 495, 'hdyg6cppjlhn', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', true, '2026-02-10 12:02:10.928737+00', '2026-02-11 03:59:56.847929+00', 'pjhfojcha3d4', '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 449, '3vjsqjeemq7i', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-06 07:45:50.219718+00', '2026-02-06 08:43:50.258133+00', 'au6rxpspqwe2', '6e2c92af-65af-4188-8d85-f7c7d02cdd3e'),
	('00000000-0000-0000-0000-000000000000', 500, 'nkajur665htg', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', true, '2026-02-11 03:59:56.860944+00', '2026-02-11 04:58:33.335496+00', 'hdyg6cppjlhn', '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 505, 'k6zdhzdeo3ze', '4a653d0e-92c9-4c58-a80e-44329f9402e4', false, '2026-02-11 05:48:48.846003+00', '2026-02-11 05:48:48.846003+00', 'vsyen6qzi3kz', '5d189730-f7c3-4980-a61b-a93de338ac1b'),
	('00000000-0000-0000-0000-000000000000', 457, 'ctlgqlfir5qm', '4a653d0e-92c9-4c58-a80e-44329f9402e4', false, '2026-02-06 11:38:02.36956+00', '2026-02-06 11:38:02.36956+00', 'kwi63zdvbym4', '6e2c92af-65af-4188-8d85-f7c7d02cdd3e'),
	('00000000-0000-0000-0000-000000000000', 435, 'wwuszvpq6dtg', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-05 09:01:58.010252+00', '2026-02-05 10:00:04.364149+00', 'izo3tpz57wei', '3d1488a7-e474-44b6-9c50-ac58efcb8438'),
	('00000000-0000-0000-0000-000000000000', 471, '2wdqhudah2ls', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-09 11:26:24.542429+00', '2026-02-09 12:24:39.039543+00', 'hhsov6scnvuq', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 478, 'dcivkpwigfyx', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 04:51:59.104132+00', '2026-02-10 05:50:13.548884+00', 'gntqe2mu22bt', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 462, 'ihtgdgutpruy', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-09 08:31:49.580461+00', '2026-02-09 09:30:02.628765+00', 'iehul2hh7os6', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 468, 'kvbyrfh7h76u', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', false, '2026-02-09 10:33:31.629302+00', '2026-02-09 10:33:31.629302+00', NULL, '218e370b-71d3-4d63-a212-91a89477224f'),
	('00000000-0000-0000-0000-000000000000', 445, 'nzuskqp6jriz', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-06 05:49:38.669638+00', '2026-02-06 06:47:50.589826+00', NULL, '6e2c92af-65af-4188-8d85-f7c7d02cdd3e'),
	('00000000-0000-0000-0000-000000000000', 484, 'tsnfgj2app6x', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-10 08:44:27.944708+00', '2026-02-10 09:42:40.109424+00', '62dlnrrpmrdu', '2c2c0ce6-1cbd-4600-a358-012d7fb4f88c'),
	('00000000-0000-0000-0000-000000000000', 485, '7q3hu7xpfoda', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 08:44:56.788327+00', '2026-02-10 09:43:34.492715+00', 'cpiwh4b2cmjz', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 491, 'mdbypc4s32bc', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 10:42:34.076921+00', '2026-02-10 11:40:37.133543+00', 'h3cy4hafsvkc', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 496, 'naz4czfmk77n', '4a653d0e-92c9-4c58-a80e-44329f9402e4', false, '2026-02-10 12:37:42.088446+00', '2026-02-10 12:37:42.088446+00', 'auznugevohus', '2c2c0ce6-1cbd-4600-a358-012d7fb4f88c'),
	('00000000-0000-0000-0000-000000000000', 501, 'x52t52nv26of', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-11 04:40:56.097916+00', '2026-02-11 05:39:16.625278+00', 'faasusewcnpg', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 506, '5vgvq3lhsqli', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', false, '2026-02-11 05:57:19.256129+00', '2026-02-11 05:57:19.256129+00', '7qdmulymzskg', '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 458, 'uuvlk2p7434a', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-09 06:35:20.317816+00', '2026-02-09 07:33:47.763497+00', NULL, '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 472, '5dmozhyccnda', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', true, '2026-02-09 11:33:02.042781+00', '2026-02-09 12:31:07.873321+00', '2s7ufghqwugp', '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 473, 'dxwhg7klp5cj', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-09 11:33:25.269548+00', '2026-02-09 12:31:25.252157+00', 'ls6iqpmzjh6o', '98db70ee-681a-48bc-a800-0038b2e84131'),
	('00000000-0000-0000-0000-000000000000', 441, 'x334vllyxonz', '4a653d0e-92c9-4c58-a80e-44329f9402e4', false, '2026-02-05 11:57:07.997569+00', '2026-02-05 11:57:07.997569+00', '6w4ijpxuehtk', '3d1488a7-e474-44b6-9c50-ac58efcb8438'),
	('00000000-0000-0000-0000-000000000000', 479, 'jrf3wzyu3wrf', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 05:50:13.572508+00', '2026-02-10 06:48:38.910863+00', 'dcivkpwigfyx', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 486, 'qo2prfhyrwfn', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', true, '2026-02-10 09:06:15.699583+00', '2026-02-10 10:04:55.458479+00', 'ahzbr6taczpe', '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 492, 'pjhfojcha3d4', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', true, '2026-02-10 11:03:31.677357+00', '2026-02-10 12:02:10.911561+00', 'wfou7mffktiv', '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 497, 'cdfrtpbeexq2', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 12:39:07.259171+00', '2026-02-11 03:42:16.292364+00', 'mrqfxea3zt3q', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 451, 'kahullqr25gv', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-06 08:43:50.261144+00', '2026-02-06 09:41:56.870366+00', '3vjsqjeemq7i', '6e2c92af-65af-4188-8d85-f7c7d02cdd3e'),
	('00000000-0000-0000-0000-000000000000', 502, 'vsyen6qzi3kz', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-11 04:50:48.743189+00', '2026-02-11 05:48:48.836172+00', 'nfleyp2qwzqv', '5d189730-f7c3-4980-a61b-a93de338ac1b'),
	('00000000-0000-0000-0000-000000000000', 474, 'plytlkkj57p3', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-09 12:24:39.055782+00', '2026-02-10 03:53:45.915557+00', '2wdqhudah2ls', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 480, 'clmcc57oaavl', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-10 06:47:34.146601+00', '2026-02-10 07:45:58.332806+00', NULL, '2c2c0ce6-1cbd-4600-a358-012d7fb4f88c'),
	('00000000-0000-0000-0000-000000000000', 464, 'uhrbvs4ughi5', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-09 09:30:02.639564+00', '2026-02-09 10:28:18.095579+00', 'ihtgdgutpruy', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 437, 'z5xqmrqrawvh', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-05 10:00:04.379772+00', '2026-02-05 10:58:43.042384+00', 'wwuszvpq6dtg', '3d1488a7-e474-44b6-9c50-ac58efcb8438'),
	('00000000-0000-0000-0000-000000000000', 487, 'upq3mlpqcndx', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-10 09:42:40.120445+00', '2026-02-10 10:40:50.810608+00', 'tsnfgj2app6x', '2c2c0ce6-1cbd-4600-a358-012d7fb4f88c'),
	('00000000-0000-0000-0000-000000000000', 488, 'h3cy4hafsvkc', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 09:43:34.501526+00', '2026-02-10 10:42:34.074176+00', '7q3hu7xpfoda', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 447, 'au6rxpspqwe2', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-06 06:47:50.592225+00', '2026-02-06 07:45:50.218688+00', 'nzuskqp6jriz', '6e2c92af-65af-4188-8d85-f7c7d02cdd3e'),
	('00000000-0000-0000-0000-000000000000', 493, 'auznugevohus', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-10 11:39:13.719389+00', '2026-02-10 12:37:42.066447+00', 'xxjzypx2uh2w', '2c2c0ce6-1cbd-4600-a358-012d7fb4f88c'),
	('00000000-0000-0000-0000-000000000000', 498, 'faasusewcnpg', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-11 03:42:16.319843+00', '2026-02-11 04:40:56.08003+00', 'cdfrtpbeexq2', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 503, '7qdmulymzskg', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', true, '2026-02-11 04:58:33.348506+00', '2026-02-11 05:57:19.245565+00', 'nkajur665htg', '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 453, 'khtole4st7hl', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-06 09:41:56.871547+00', '2026-02-06 10:40:02.386731+00', 'kahullqr25gv', '6e2c92af-65af-4188-8d85-f7c7d02cdd3e'),
	('00000000-0000-0000-0000-000000000000', 454, 'kwi63zdvbym4', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-06 10:40:02.414343+00', '2026-02-06 11:38:02.350244+00', 'khtole4st7hl', '6e2c92af-65af-4188-8d85-f7c7d02cdd3e'),
	('00000000-0000-0000-0000-000000000000', 433, 'izo3tpz57wei', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-05 08:03:36.457299+00', '2026-02-05 09:01:57.994015+00', NULL, '3d1488a7-e474-44b6-9c50-ac58efcb8438'),
	('00000000-0000-0000-0000-000000000000', 460, 'iehul2hh7os6', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-09 07:33:47.789581+00', '2026-02-09 08:31:49.566552+00', 'uuvlk2p7434a', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 476, '7e6shju2cgvt', '4a653d0e-92c9-4c58-a80e-44329f9402e4', false, '2026-02-09 12:31:25.253545+00', '2026-02-09 12:31:25.253545+00', 'dxwhg7klp5cj', '98db70ee-681a-48bc-a800-0038b2e84131'),
	('00000000-0000-0000-0000-000000000000', 481, 'ktof6vfiaca2', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 06:48:38.911702+00', '2026-02-10 07:46:39.280321+00', 'jrf3wzyu3wrf', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 475, 'ahzbr6taczpe', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', true, '2026-02-09 12:31:07.874099+00', '2026-02-10 09:06:15.681091+00', '5dmozhyccnda', '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 489, 'wfou7mffktiv', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', true, '2026-02-10 10:04:55.476365+00', '2026-02-10 11:03:31.662576+00', 'qo2prfhyrwfn', '0a9efa57-11ff-4a1e-853b-4e8d7d8d91d1'),
	('00000000-0000-0000-0000-000000000000', 494, 'mrqfxea3zt3q', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', true, '2026-02-10 11:40:37.134428+00', '2026-02-10 12:39:07.257561+00', 'mdbypc4s32bc', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe'),
	('00000000-0000-0000-0000-000000000000', 499, 'nfleyp2qwzqv', '4a653d0e-92c9-4c58-a80e-44329f9402e4', true, '2026-02-11 03:52:31.577472+00', '2026-02-11 04:50:48.730812+00', NULL, '5d189730-f7c3-4980-a61b-a93de338ac1b'),
	('00000000-0000-0000-0000-000000000000', 504, '3nvxxxiqeajf', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', false, '2026-02-11 05:39:16.640241+00', '2026-02-11 05:39:16.640241+00', 'x52t52nv26of', '1355a0f5-b355-4726-a5a2-8ec98f0b0afe');


--
-- Data for Name: sso_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_providers; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: saml_relay_states; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: sso_domains; Type: TABLE DATA; Schema: auth; Owner: supabase_auth_admin
--



--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."positions" ("id", "name", "description", "created_at", "department", "access_level", "base_salary") VALUES
	('be5b55f3-ec03-4f5d-9fbd-4cc2fc299a54', 'Manager', NULL, '2026-01-20 11:44:48.447767+00', 'Administration', 'manager', NULL),
	('1bf51ebe-e5da-48e6-9b2e-147dc26dfe82', 'Admin', NULL, '2026-01-20 11:44:48.447767+00', 'Administration', 'admin', NULL),
	('a15bd545-c749-4400-866b-cd774410f70a', 'mechanic', NULL, '2026-01-20 11:45:32.506352+00', 'Service', 'staff', NULL);


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."employees" ("id", "name", "position", "role", "created_at", "position_id", "access_level", "user_id", "email", "phone", "salary", "status", "hire_date", "emergency_contact", "emergency_phone", "address", "notes", "updated_at", "joining_date", "aadhaar_number", "pan_number", "date_of_birth", "blood_group", "pay_type") VALUES
	('96aed6d7-7168-4a7d-97be-920f6b58aecd', 'vishnu', 'Staff', 'staff', '2026-01-29 07:16:00.982571+00', 'be5b55f3-ec03-4f5d-9fbd-4cc2fc299a54', 'admin', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', 'vishnu@gmail.com', NULL, NULL, 'active', NULL, NULL, NULL, NULL, NULL, '2026-01-29 07:16:00.982571+00', '2026-01-30', NULL, NULL, NULL, NULL, 'monthly'),
	('2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'ram', 'Staff', 'staff', '2026-01-22 04:36:30.276435+00', 'a15bd545-c749-4400-866b-cd774410f70a', 'staff', '4a653d0e-92c9-4c58-a80e-44329f9402e4', 'ram@gmail.com', '908776545', 6700.00, 'active', NULL, NULL, NULL, NULL, NULL, '2026-01-30 09:42:15.165728+00', '2026-01-30', NULL, NULL, NULL, NULL, 'weekly');


--
-- Data for Name: attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."attendance" ("id", "employee_id", "date", "status", "overtime_hours", "check_in", "check_out", "notes", "created_at", "updated_at", "marked_by", "updated_by", "remarks") VALUES
	('a291826d-815b-4c77-b2f2-20eb07a887b1', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-01-29', 'present', 0.00, NULL, NULL, NULL, '2026-01-30 10:00:48.490712+00', '2026-01-30 10:00:48.490712+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', ''),
	('3bb5874f-813e-448a-b970-8fda45b4c029', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-01-29', 'present', 0.00, NULL, NULL, NULL, '2026-01-30 10:00:48.490712+00', '2026-01-30 10:00:48.490712+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', ''),
	('f6884921-ae2d-4b0a-ab92-d8e510c989d7', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-01-30', 'present', 0.00, NULL, NULL, NULL, '2026-01-30 10:00:37.329457+00', '2026-01-30 10:00:37.329457+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', ''),
	('383b2c3d-3c89-4c28-b5fe-3222e4771ad9', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-01-30', 'half-day', 0.00, NULL, NULL, NULL, '2026-01-30 10:00:37.329457+00', '2026-01-30 10:00:37.329457+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', ''),
	('ec785d7b-9afa-4d55-8058-609323b42f70', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-02-01', 'holiday', 0.00, NULL, NULL, NULL, '2026-02-02 05:58:28.975702+00', '2026-02-02 05:58:28.975702+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', ''),
	('a92ba8eb-6119-4551-803f-f1dfeff40822', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-02-01', 'holiday', 0.00, NULL, NULL, NULL, '2026-02-02 05:58:28.975702+00', '2026-02-02 05:58:28.975702+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', ''),
	('bb41e3ab-e4b5-4d78-bbc0-dde467d8224b', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-02-03', 'present', 0.00, NULL, NULL, NULL, '2026-02-03 10:46:12.690041+00', '2026-02-03 10:46:12.690041+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', ''),
	('3ab3eca4-b84b-47c0-ac65-bcaa5e83c7ab', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-02-03', 'present', 0.00, NULL, NULL, NULL, '2026-02-03 10:46:12.690041+00', '2026-02-03 10:46:12.690041+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', ''),
	('7062a7b7-edaa-4f72-ba24-1228521cf016', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-02-04', 'present', 0.00, NULL, NULL, NULL, '2026-02-04 04:58:51.820708+00', '2026-02-04 04:58:51.820708+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', ''),
	('68d21741-c1d4-42f6-9033-1b1772123cce', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-02-04', 'present', 0.00, NULL, NULL, NULL, '2026-02-04 04:58:51.820708+00', '2026-02-04 04:58:51.820708+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '');


--
-- Data for Name: attendance_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."attendance_history" ("id", "attendance_id", "employee_id", "date", "old_status", "new_status", "old_remarks", "new_remarks", "changed_by", "changed_at") VALUES
	('1b5c884c-a53d-4d15-aa5b-7340f03d37bd', 'f6884921-ae2d-4b0a-ab92-d8e510c989d7', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-01-30', NULL, 'present', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:00:37.329457+00'),
	('5280a5d0-2853-4b30-a7dc-c1c8cef37943', '383b2c3d-3c89-4c28-b5fe-3222e4771ad9', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-01-30', NULL, 'present', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:00:37.329457+00'),
	('46625e79-6ac7-4e29-88f2-9ff3e1b8acf1', 'a291826d-815b-4c77-b2f2-20eb07a887b1', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-01-29', NULL, 'present', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:00:48.490712+00'),
	('e4b5bb75-1b53-462e-b7d4-1d75a766c31f', '3bb5874f-813e-448a-b970-8fda45b4c029', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-01-29', NULL, 'present', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:00:48.490712+00'),
	('bbd984ee-a8a0-438c-a032-d7c4974ac20f', '383b2c3d-3c89-4c28-b5fe-3222e4771ad9', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-01-30', 'present', 'half-day', '', '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:01:18.951469+00'),
	('c530479f-59c4-45aa-a4a0-2ddc137469a0', '383b2c3d-3c89-4c28-b5fe-3222e4771ad9', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-01-30', 'half-day', 'present', '', '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:18:40.644238+00'),
	('87c02c99-7b26-4867-99d2-499cb4c5a9c9', '383b2c3d-3c89-4c28-b5fe-3222e4771ad9', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-01-30', 'present', 'half-day', '', '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:35:05.654452+00'),
	('6cbedb79-1a3b-4085-b0e8-77e958be917a', '383b2c3d-3c89-4c28-b5fe-3222e4771ad9', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-01-30', 'half-day', 'present', '', '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:39:49.175854+00'),
	('044fa816-0462-4063-b29c-cdb8380ee223', '383b2c3d-3c89-4c28-b5fe-3222e4771ad9', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-01-30', 'present', 'half-day', '', '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:40:02.941952+00'),
	('f4964de3-655e-4a59-a828-42066f783850', 'f6884921-ae2d-4b0a-ab92-d8e510c989d7', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-01-30', 'present', 'half-day', '', '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:44:35.692474+00'),
	('7ced7ff5-a64b-4cb0-b8cd-7e533d290d27', 'f6884921-ae2d-4b0a-ab92-d8e510c989d7', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-01-30', 'half-day', 'present', '', '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:45:06.596069+00'),
	('9c645493-b4e8-4146-baf2-2719b587abb2', 'f6884921-ae2d-4b0a-ab92-d8e510c989d7', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-01-30', 'present', 'half-day', '', '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:49:17.172028+00'),
	('d6f14ef4-95f6-48fb-8ef2-3514c6dd2aa0', 'f6884921-ae2d-4b0a-ab92-d8e510c989d7', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-01-30', 'half-day', 'present', '', '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-30 10:54:12.184172+00'),
	('4837a8e6-d0b2-4c97-b236-edb49a91cd84', 'ec785d7b-9afa-4d55-8058-609323b42f70', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-02-01', NULL, 'holiday', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-02 05:58:28.975702+00'),
	('5dd13b93-d154-4c1c-a279-fb786c5812ab', 'a92ba8eb-6119-4551-803f-f1dfeff40822', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-02-01', NULL, 'holiday', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-02 05:58:28.975702+00'),
	('00f9cfe0-f9a8-4393-aa4d-df125428ceb3', 'bb41e3ab-e4b5-4d78-bbc0-dde467d8224b', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-02-03', NULL, 'present', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-03 10:46:12.690041+00'),
	('02969dfc-48d8-40ff-a434-97b32838e3d4', '3ab3eca4-b84b-47c0-ac65-bcaa5e83c7ab', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-02-03', NULL, 'present', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-03 10:46:12.690041+00'),
	('f5b0c124-ebe5-4d60-a8d6-6e68448a2a72', '7062a7b7-edaa-4f72-ba24-1228521cf016', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-02-04', NULL, 'present', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-04 04:58:51.820708+00'),
	('5a38ebd7-97b0-4768-bdd2-bb623b9390a9', '68d21741-c1d4-42f6-9033-1b1772123cce', '96aed6d7-7168-4a7d-97be-920f6b58aecd', '2026-02-04', NULL, 'present', NULL, '', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-04 04:58:51.820708+00');


--
-- Data for Name: company_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."company_profiles" ("id", "company_name", "address", "phone", "email", "website", "tax_id", "logo_url", "bank_details", "created_at", "updated_at", "payment_qr_code_url", "acc_name", "acc_number", "ifsc", "bank_name", "upi_id", "owner_name", "owner_phone") VALUES
	('1963e1ee-85af-4cca-af3d-bd805c15cee2', 'Amma Auto Garage', '123 Main St, Auto Nagar', '7907665645', 'ammaautogarage.com', NULL, NULL, 'https://qyfihvkpqrzuskjzqhzd.supabase.co/storage/v1/object/public/public-assets/logo-1770008637057.png', '{"bankName": "amma auto garage", "ifscCode": "HDFC9990", "accountName": "test", "accountNumber": "1234567890"}', '2026-01-27 09:29:34.61259+00', '2026-01-27 09:29:34.61259+00', 'https://qyfihvkpqrzuskjzqhzd.supabase.co/storage/v1/object/public/qr-codes/qr-code-1769601168914.png', NULL, NULL, NULL, NULL, NULL, 'Vishnu ', '7907665638');


--
-- Data for Name: custom_work_items; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."customers" ("id", "name", "email", "phone", "address", "created_at", "user_id", "company_name", "updated_at", "gst_number") VALUES
	('ad664ff3-02aa-4c70-8ff1-f4ca61b20fda', 'tony', 'tony@gmail.com', '908776545', '', '2026-01-21 11:59:33.273323+00', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', 'stark industries', '2026-01-29 05:53:13.787357+00', '27ABCDE1234F1Z5');


--
-- Data for Name: document_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."document_settings" ("id", "doc_type", "prefix", "current_number", "min_digits", "show_rates", "show_taxes", "show_discounts", "show_fc_details", "show_service_history", "title", "terms_and_conditions", "footer_text", "updated_at") VALUES
	('741d43d0-7360-4984-980d-48d3d91fdc9a', 'work_slip', 'WS-', 1, 4, true, true, false, true, false, 'WORK ORDER / ESTIMATE', '1. Goods once sold will not be taken back.\n2. Service warranty valid for 30 days.\n3. Payment due immediately upon completion.', NULL, '2026-01-27 09:25:20.95764+00'),
	('c5225d45-f397-4149-a0ec-629fd48fda79', 'invoice', 'INV-', 1, 4, true, true, false, true, false, 'TAX INVOICE', '1. Interest @ 18% p.a. will be charged if bill is not paid on due date.\n2. Subject to local jurisdiction.', NULL, '2026-01-27 09:25:20.95764+00');


--
-- Data for Name: employee_payouts; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."employee_payouts" ("id", "employee_id", "period_start", "period_end", "base_calc", "attendance_adj", "job_incentives", "overtime_pay", "bonuses", "deductions", "total_amount", "status", "payment_date", "notes", "created_at", "updated_at", "days_present", "arrears_adj") VALUES
	('e3c40d21-2b8f-4f19-92af-68eea56705ec', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', '2026-01-01', '2026-01-30', 180.00, 0.00, 0.00, 0.00, 0.00, 0.00, 180.00, 'paid', '2026-01-30 10:10:43.432+00', 'Regular payout period.', '2026-01-30 10:01:46.074002+00', '2026-01-30 10:40:09.667179+00', 2.0, 0.00);


--
-- Data for Name: employee_salary_configs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."employee_salary_configs" ("id", "employee_id", "pay_type", "base_amount", "overtime_rate", "job_incentive_rate", "allowances", "is_active", "created_at", "updated_at") VALUES
	('1b9a8f33-598e-4f44-a1c5-240175bc7263', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'daily', 90.00, 0.00, 0.00, 0.00, true, '2026-01-30 09:27:33.766074+00', '2026-01-30 09:43:22.339+00'),
	('bb2f2a13-4f39-497a-9d2d-f9aeb11d2405', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'daily', 900.00, 0.00, 0.00, 0.00, true, '2026-01-30 10:02:16.838793+00', '2026-01-30 10:02:16.416+00');


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inventory" ("id", "item_name", "category", "quantity", "unit_price", "reorder_level", "supplier", "location", "created_at", "updated_at", "sku", "available_qty", "reserved_qty", "qr_code", "hsn_code", "gst_rate", "cgst_rate", "sgst_rate") VALUES
	('a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'Engine Oil ', 'Mechanical', 96, 670.00, 10, NULL, 'R1-S2-P1', '2026-01-29 07:01:10.953987+00', '2026-02-05 12:09:47.920147+00', 'MEC-1488', 99, -3, 'MEC-1488', NULL, 18.0, 9.0, 9.0),
	('e898021e-4d8d-44d1-bb54-086e22cf9047', 'Bolt Nut', 'Accessory', 14, 90.00, 5, NULL, 'R1-S2-P1', '2026-02-03 08:52:51.06838+00', '2026-02-09 10:36:22.875412+00', 'ACC-9096', 15, -1, 'ACC-9096', '9999', 18, 9, 9);


--
-- Data for Name: vehicle_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vehicle_categories" ("id", "name", "created_at") VALUES
	('0c3395fc-33ae-4174-83d9-9311f347e3c4', 'Truck', '2026-02-02 08:41:03.882956+00'),
	('deefb129-93a1-412e-8a7d-35ca77a543f4', 'Bus', '2026-02-02 08:41:03.882956+00'),
	('23b4b707-59b7-49b9-bf14-e18312630359', 'Pickup', '2026-02-02 08:41:03.882956+00'),
	('0a76894a-ad79-4edd-82b5-279cf9d03852', 'Van', '2026-02-02 08:41:03.882956+00'),
	('2a52ba4f-1757-4267-b292-de76f6e30678', 'Utility', '2026-02-02 08:41:03.882956+00'),
	('833c2099-efe2-4474-8e6a-1e813b2a9b20', 'Commercial Van', '2026-02-02 08:41:04.543319+00'),
	('80d5f3cc-c6f5-428d-b3d9-4ff7bfc26ee3', 'Heavy Machinery', '2026-02-02 08:41:04.543319+00'),
	('99b9ea59-93e5-4a20-9b03-d1313fc57762', '', '2026-02-02 10:38:49.730587+00');


--
-- Data for Name: vehicle_manufacturers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vehicle_manufacturers" ("id", "name", "created_at") VALUES
	('27cf912a-a58d-4d6e-b8c7-e771028adbd4', 'ASHOK LEYLAND', '2026-02-02 08:41:03.882956+00'),
	('03bd9666-511d-4ecc-8277-de75c6e4d740', 'MAHINDRA', '2026-02-02 08:41:03.882956+00'),
	('310d0fa4-3a9b-4f13-a633-dc8f0edd48aa', 'BHARATBENZ', '2026-02-02 08:41:03.882956+00'),
	('24fe6780-96c0-49a7-ba23-8f35f2f5c9c8', 'SML ISUZU', '2026-02-02 08:41:03.882956+00'),
	('69370830-8fbb-4609-b027-a04d26b4592e', 'BAHARTH', '2026-02-02 08:41:04.543319+00'),
	('7589f126-3350-4e90-8d15-37216beff577', 'HUMMER', '2026-02-02 08:41:04.543319+00'),
	('bcc8f68a-6d83-41be-b7ac-5a64e8240403', 'Tata Motors', '2026-02-02 09:03:43.960481+00'),
	('e5518417-107f-4f81-838a-e6c88d3f56a7', 'Eicher Motors', '2026-02-02 09:03:43.960481+00'),
	('fcaf9dfb-14e6-4b80-8ce8-61c2612987ed', 'Force Motors', '2026-02-02 09:03:43.960481+00'),
	('dc99d36f-01c6-48c9-8f69-1fbcd1b73289', 'Nissan', '2026-02-02 09:03:43.960481+00'),
	('53fcef51-9ee8-4a37-b593-916f0378b5ea', 'TATA', '2026-02-02 10:38:49.730587+00'),
	('408c33da-8d56-4a54-b051-344d524fbed4', 'OTHER', '2026-02-02 10:38:49.730587+00');


--
-- Data for Name: vehicle_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vehicle_types" ("id", "name", "category_id", "base_workload_multiplier", "created_at") VALUES
	('973bad52-dd86-4126-a3a8-f3f51d399df1', 'HCV', '0c3395fc-33ae-4174-83d9-9311f347e3c4', 1.50, '2026-02-02 08:41:03.882956+00'),
	('adc809c0-c225-4199-99d1-448de7fe5044', 'MCV', '0c3395fc-33ae-4174-83d9-9311f347e3c4', 1.20, '2026-02-02 08:41:03.882956+00'),
	('aa204b94-1ad8-4ab0-a79a-f6cec8777a73', 'LCV', '0c3395fc-33ae-4174-83d9-9311f347e3c4', 1.00, '2026-02-02 08:41:03.882956+00'),
	('395e783c-ec2e-43d5-ad27-936770c18a5c', 'Small Commercial', '0c3395fc-33ae-4174-83d9-9311f347e3c4', 0.80, '2026-02-02 08:41:03.882956+00'),
	('5585c976-01fa-49a8-acc0-7390e0593d88', 'Large Bus', 'deefb129-93a1-412e-8a7d-35ca77a543f4', 1.40, '2026-02-02 08:41:03.882956+00'),
	('d5bb930a-1de9-4f7b-b606-d73c9e80b7f5', 'Mini Bus', 'deefb129-93a1-412e-8a7d-35ca77a543f4', 1.10, '2026-02-02 08:41:03.882956+00'),
	('d4741bf1-abc2-4dd3-a527-8efc0779a3e4', 'Standard Commercial Van', '833c2099-efe2-4474-8e6a-1e813b2a9b20', 1.00, '2026-02-02 08:41:04.543319+00'),
	('69cf3577-683a-49d0-92c7-37f81a7ad0a1', 'Standard Heavy Machinery', '80d5f3cc-c6f5-428d-b3d9-4ff7bfc26ee3', 1.00, '2026-02-02 08:41:04.543319+00'),
	('94583164-d19d-4bbb-b021-fafb3f6358ff', 'Bus Chassis', 'deefb129-93a1-412e-8a7d-35ca77a543f4', 1.00, '2026-02-02 09:03:43.960481+00'),
	('6086ebae-7ada-4547-b0fe-2993f2ebfc89', 'Light Commercial Truck', '0c3395fc-33ae-4174-83d9-9311f347e3c4', 1.00, '2026-02-02 09:03:43.960481+00'),
	('393615f3-1c79-465d-8bc6-5340a8bad63b', 'Medium Commercial Truck', '0c3395fc-33ae-4174-83d9-9311f347e3c4', 1.00, '2026-02-02 09:03:43.960481+00'),
	('6b0be0a8-aa14-47f2-8a47-b0818cc369e1', 'Heavy Commercial Truck', '0c3395fc-33ae-4174-83d9-9311f347e3c4', 1.00, '2026-02-02 09:03:43.960481+00'),
	('18722c4c-11ed-42e4-91b0-6a390331f322', 'Mini Truck', '23b4b707-59b7-49b9-bf14-e18312630359', 1.00, '2026-02-02 09:03:43.960481+00'),
	('50b58e62-da33-46de-9f00-abc9d61bf058', 'Passenger Van', '0a76894a-ad79-4edd-82b5-279cf9d03852', 1.00, '2026-02-02 09:03:43.960481+00'),
	('cbaf39ba-ea04-4ae2-8248-ce200a7e0127', 'Passenger/Cargo Van', '0a76894a-ad79-4edd-82b5-279cf9d03852', 1.00, '2026-02-02 09:03:43.960481+00'),
	('5ed1ba45-df24-47bd-a6bd-5a07ddac7da4', 'Pickup Truck', '23b4b707-59b7-49b9-bf14-e18312630359', 1.00, '2026-02-02 09:03:43.960481+00'),
	('9455519d-2561-4e5d-a37a-83faf48845c3', 'Light & Medium Truck', '0c3395fc-33ae-4174-83d9-9311f347e3c4', 1.00, '2026-02-02 09:03:43.960481+00'),
	('ed1a5243-bc7c-491d-a3af-e4ff4d5e6c34', 'Small Pickup', '23b4b707-59b7-49b9-bf14-e18312630359', 1.00, '2026-02-02 09:03:43.960481+00'),
	('dd947db5-ffe5-4930-916c-625996941ed5', 'Electric Mini Truck', '23b4b707-59b7-49b9-bf14-e18312630359', 1.00, '2026-02-02 09:03:43.960481+00'),
	('fbb36028-cde8-4bb1-8125-2404cd44b8cc', 'Cargo Van', '0a76894a-ad79-4edd-82b5-279cf9d03852', 1.00, '2026-02-02 09:03:43.960481+00'),
	('46944d24-2ff6-4cd6-a22a-6321064c6b5d', 'Utility Vehicle', '2a52ba4f-1757-4267-b292-de76f6e30678', 1.00, '2026-02-02 09:03:43.960481+00'),
	('7d268714-6b7f-4ed0-9f4f-12a3f23827a6', 'Cab-over Van', '0a76894a-ad79-4edd-82b5-279cf9d03852', 1.00, '2026-02-02 09:03:43.960481+00'),
	('3c322551-288c-465d-98ed-af4121e55ae9', 'Standard ', '99b9ea59-93e5-4a20-9b03-d1313fc57762', 1.00, '2026-02-02 10:38:49.730587+00');


--
-- Data for Name: vehicle_models; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vehicle_models" ("id", "name", "manufacturer_id", "vehicle_type_id", "created_at") VALUES
	('b54f5ea8-a771-46b2-ba63-e16c11293336', 'Tata 1510', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '94583164-d19d-4bbb-b021-fafb3f6358ff', '2026-02-02 09:03:43.960481+00'),
	('a3c833c3-5b47-429c-a5b8-c14b1c40c2a9', 'Tata 1512', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '94583164-d19d-4bbb-b021-fafb3f6358ff', '2026-02-02 09:03:43.960481+00'),
	('e0f60d2a-369b-41c3-a742-424636866db8', 'Tata 407', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '6086ebae-7ada-4547-b0fe-2993f2ebfc89', '2026-02-02 09:03:43.960481+00'),
	('7afef36d-2fcd-4ccf-b7b5-9152f7bc6139', 'Tata 608', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '6086ebae-7ada-4547-b0fe-2993f2ebfc89', '2026-02-02 09:03:43.960481+00'),
	('d15b9f38-7c85-43da-aa71-4158a1575829', 'Tata 709', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '393615f3-1c79-465d-8bc6-5340a8bad63b', '2026-02-02 09:03:43.960481+00'),
	('83a0bd55-7281-4494-840e-ae05a68dc134', 'Tata 1109', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '393615f3-1c79-465d-8bc6-5340a8bad63b', '2026-02-02 09:03:43.960481+00'),
	('9ead56af-097a-4f51-917b-bde588a419a8', 'Tata LPK Series', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '6b0be0a8-aa14-47f2-8a47-b0818cc369e1', '2026-02-02 09:03:43.960481+00'),
	('d067d25f-2e5b-4284-bc0d-9e9b63e5f347', 'Tata SFC Series', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '6086ebae-7ada-4547-b0fe-2993f2ebfc89', '2026-02-02 09:03:43.960481+00'),
	('34eeae3e-92bd-4e89-a86d-f9ef3074c827', 'Tata Ace', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '18722c4c-11ed-42e4-91b0-6a390331f322', '2026-02-02 09:03:43.960481+00'),
	('9304da80-2a4d-4861-80c2-69d092cd5d7a', 'Tata Ace Zip', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '18722c4c-11ed-42e4-91b0-6a390331f322', '2026-02-02 09:03:43.960481+00'),
	('33caddd9-7e46-4353-9adf-56a063c5768d', 'Tata Ace Mega', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '18722c4c-11ed-42e4-91b0-6a390331f322', '2026-02-02 09:03:43.960481+00'),
	('132bdcac-8406-4e9d-844d-0dccf2780ed6', 'Tata Magic', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '50b58e62-da33-46de-9f00-abc9d61bf058', '2026-02-02 09:03:43.960481+00'),
	('e6120493-a09d-4566-942d-883e619fe9eb', 'Tata Winger', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', 'cbaf39ba-ea04-4ae2-8248-ce200a7e0127', '2026-02-02 09:03:43.960481+00'),
	('550a9cb5-85bd-42b6-a987-293007af0b59', 'Tata Xenon', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '5ed1ba45-df24-47bd-a6bd-5a07ddac7da4', '2026-02-02 09:03:43.960481+00'),
	('f4abc354-4b0b-4c66-a6dd-8e5664c68c95', 'Tata Prima', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '6b0be0a8-aa14-47f2-8a47-b0818cc369e1', '2026-02-02 09:03:43.960481+00'),
	('9dcebb5f-a27b-40e9-8e62-3f56338b9ff9', 'Tata Signa', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '6b0be0a8-aa14-47f2-8a47-b0818cc369e1', '2026-02-02 09:03:43.960481+00'),
	('022b6cc1-6115-4c88-b359-f0e8b499c3c9', 'Tata Ultra', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '9455519d-2561-4e5d-a37a-83faf48845c3', '2026-02-02 09:03:43.960481+00'),
	('504f61bd-01a4-4838-88a2-415a5dc14f52', 'Tata Intra', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', 'ed1a5243-bc7c-491d-a3af-e4ff4d5e6c34', '2026-02-02 09:03:43.960481+00'),
	('a76a8b74-f8b6-4461-9a26-e99ed2c2ceb9', 'Tata Ace EV', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', 'dd947db5-ffe5-4930-916c-625996941ed5', '2026-02-02 09:03:43.960481+00'),
	('0c076b22-aa2c-4a02-b11a-ba8ef83dba59', 'Tata Winger Cargo', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', 'fbb36028-cde8-4bb1-8125-2404cd44b8cc', '2026-02-02 09:03:43.960481+00'),
	('227b5575-af20-4268-9fb3-b6d048617d7e', 'Eicher 10.10', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '393615f3-1c79-465d-8bc6-5340a8bad63b', '2026-02-02 09:03:43.960481+00'),
	('5386f86f-962f-49ac-959f-98cbcc7062db', 'Eicher 20.16', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '6b0be0a8-aa14-47f2-8a47-b0818cc369e1', '2026-02-02 09:03:43.960481+00'),
	('b88a3cd1-7108-4d70-b3f9-1e47c41e9907', 'Eicher Pro 1049', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '6086ebae-7ada-4547-b0fe-2993f2ebfc89', '2026-02-02 09:03:43.960481+00'),
	('a1e1d2ff-6aa5-4ce0-abc5-6c84e4b0a2ec', 'Eicher Pro 2049', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '6086ebae-7ada-4547-b0fe-2993f2ebfc89', '2026-02-02 09:03:43.960481+00'),
	('e623638c-92f8-4e4b-a5db-cc2d78817743', 'Eicher Pro 3015', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '393615f3-1c79-465d-8bc6-5340a8bad63b', '2026-02-02 09:03:43.960481+00'),
	('fb9b321d-c11f-4ce8-97c3-f5e370897687', 'Eicher Pro 3019', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '393615f3-1c79-465d-8bc6-5340a8bad63b', '2026-02-02 09:03:43.960481+00'),
	('937bb776-3cac-4dbe-b489-e188549cba70', 'Eicher Pro 6025', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '6b0be0a8-aa14-47f2-8a47-b0818cc369e1', '2026-02-02 09:03:43.960481+00'),
	('c5821bb9-b488-430d-9400-ff85ff911405', 'Eicher Pro 6041', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '6b0be0a8-aa14-47f2-8a47-b0818cc369e1', '2026-02-02 09:03:43.960481+00'),
	('01e10d46-792d-40f7-a6cb-a0a59d753c08', 'Eicher Pro Bus Series', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '94583164-d19d-4bbb-b021-fafb3f6358ff', '2026-02-02 09:03:43.960481+00'),
	('7319f929-9f3c-40db-b9bd-bf14837361db', 'Eicher Polaris Multix', 'e5518417-107f-4f81-838a-e6c88d3f56a7', '46944d24-2ff6-4cd6-a22a-6321064c6b5d', '2026-02-02 09:03:43.960481+00'),
	('4fe2de3e-75e4-43fe-b169-1d7ecf9c6f3c', 'Tempo Traveller', 'fcaf9dfb-14e6-4b80-8ce8-61c2612987ed', '50b58e62-da33-46de-9f00-abc9d61bf058', '2026-02-02 09:03:43.960481+00'),
	('9ec8b346-137b-4ce1-a595-a610d24fd710', 'Force Traveller', 'fcaf9dfb-14e6-4b80-8ce8-61c2612987ed', '50b58e62-da33-46de-9f00-abc9d61bf058', '2026-02-02 09:03:43.960481+00'),
	('c7ea3c48-e6c2-4d99-ac63-3cb6a5bfa29e', 'Force Traveller T1', 'fcaf9dfb-14e6-4b80-8ce8-61c2612987ed', 'fbb36028-cde8-4bb1-8125-2404cd44b8cc', '2026-02-02 09:03:43.960481+00'),
	('806d7aa0-8ba0-4633-aa8e-0063666ea93f', 'Force Trax', 'fcaf9dfb-14e6-4b80-8ce8-61c2612987ed', '46944d24-2ff6-4cd6-a22a-6321064c6b5d', '2026-02-02 09:03:43.960481+00'),
	('3f571180-be5a-48b0-92c8-5a1e091ac625', 'Force Gurkha (Commercial)', 'fcaf9dfb-14e6-4b80-8ce8-61c2612987ed', '46944d24-2ff6-4cd6-a22a-6321064c6b5d', '2026-02-02 09:03:43.960481+00'),
	('fcdae398-5bb3-4eab-87f7-2d4c6de55896', 'Nissan Vanette', 'dc99d36f-01c6-48c9-8f69-1fbcd1b73289', '7d268714-6b7f-4ed0-9f4f-12a3f23827a6', '2026-02-02 09:03:43.960481+00'),
	('9224d64f-9537-4ac0-9f04-1d437c72cb6b', 'Nissan Caravan', 'dc99d36f-01c6-48c9-8f69-1fbcd1b73289', 'cbaf39ba-ea04-4ae2-8248-ce200a7e0127', '2026-02-02 09:03:43.960481+00'),
	('7876400e-5e6a-4ff1-9e0d-d82faa389812', 'Nissan Atlas', 'dc99d36f-01c6-48c9-8f69-1fbcd1b73289', '6086ebae-7ada-4547-b0fe-2993f2ebfc89', '2026-02-02 09:03:43.960481+00'),
	('43199638-e375-48f3-ae93-517fa38c3a26', 'Nissan NT400 Cabstar', 'dc99d36f-01c6-48c9-8f69-1fbcd1b73289', '6086ebae-7ada-4547-b0fe-2993f2ebfc89', '2026-02-02 09:03:43.960481+00'),
	('a4110b09-ec96-4112-9b78-99b791c3fc2b', 'tata 407', 'bcc8f68a-6d83-41be-b7ac-5a64e8240403', '973bad52-dd86-4126-a3a8-f3f51d399df1', '2026-02-02 08:41:04.543319+00'),
	('0b4ef544-83b9-43fd-ae6e-163645dd57af', 'tata 407', '53fcef51-9ee8-4a37-b593-916f0378b5ea', '973bad52-dd86-4126-a3a8-f3f51d399df1', '2026-02-02 10:38:49.730587+00'),
	('2923ad85-2d67-4ea8-ae68-7c62a9f60a79', 'baharth benz', '69370830-8fbb-4609-b027-a04d26b4592e', 'd4741bf1-abc2-4dd3-a527-8efc0779a3e4', '2026-02-02 08:41:04.543319+00'),
	('3810da13-1d79-48d7-a542-dabad10d1049', 'hummer', '7589f126-3350-4e90-8d15-37216beff577', '69cf3577-683a-49d0-92c7-37f81a7ad0a1', '2026-02-02 08:41:04.543319+00'),
	('2ba7abb6-dde5-4043-8fa5-580866e03304', 'Unknown Model', '408c33da-8d56-4a54-b051-344d524fbed4', '3c322551-288c-465d-98ed-af4121e55ae9', '2026-02-02 10:38:49.730587+00');


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."vehicles" ("id", "vehicle_no", "customer_id", "created_at", "vehicle_type", "model", "year", "status", "notes", "entry_date", "updated_at", "vehicle_number", "fc_number", "fc_expiry_date", "last_fc_date", "kilometers_driven", "next_service_km", "next_service_date", "color", "vin", "engine_number", "model_id") VALUES
	('a6103d07-0cdc-418d-b2f8-be1e0bef4c30', '', 'ad664ff3-02aa-4c70-8ff1-f4ca61b20fda', '2026-01-23 10:37:51.019036+00', 'Heavy Machinery', 'hummer', 2026, 'In Progress', '', '2026-01-23 10:37:50.949+00', '2026-02-03 11:40:14.007817+00', 'TN09H5567', NULL, NULL, NULL, 10000, 11000, '2026-12-31', '', '', '', '3810da13-1d79-48d7-a542-dabad10d1049'),
	('5ca54924-6a7f-4717-94c5-6c81d023f3b1', '', 'ad664ff3-02aa-4c70-8ff1-f4ca61b20fda', '2026-01-21 11:59:55.772559+00', 'Truck', 'tata 407', 2026, 'In Progress', NULL, '2026-01-21 11:59:55.65+00', '2026-02-04 07:04:41.271733+00', 'TN09H5565', NULL, NULL, NULL, 0, NULL, NULL, NULL, NULL, NULL, '0b4ef544-83b9-43fd-ae6e-163645dd57af'),
	('0938a876-a75d-4520-9cb6-01e3a0b14567', '', 'ad664ff3-02aa-4c70-8ff1-f4ca61b20fda', '2026-01-28 10:15:18.753515+00', 'Commercial Van', 'baharth benz', 2007, 'In Progress', NULL, NULL, '2026-02-04 12:12:58.534181+00', 'KL50M5559', NULL, NULL, NULL, 89000, 80000, NULL, 'brown', '8979271792', '182878277987982', '2923ad85-2d67-4ea8-ae68-7c62a9f60a79'),
	('73e87a2b-06fd-4867-9889-0ec6ee42d19a', '', 'ad664ff3-02aa-4c70-8ff1-f4ca61b20fda', '2026-02-02 09:37:21.338981+00', '', NULL, 2000, 'In Progress', 'Testing Vehicle for Service', '2026-02-02 09:37:21.087+00', '2026-02-11 06:04:15.360557+00', 'TN55B7777', NULL, NULL, NULL, 9000, 10000, '2028-06-13', 'Green', '89792717921', '182878277987982', '227b5575-af20-4268-9fb3-b6d048617d7e');


--
-- Data for Name: work_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."work_orders" ("id", "vehicle_id", "assigned_to", "service_type", "description", "status", "priority", "estimated_cost", "actual_cost", "started_at", "completed_at", "created_at", "updated_at", "current_stage", "requires_approval", "approved_by", "approved_at", "accepted_at", "customer_visible", "notes", "portal_updated_at", "repair_completed_at", "inspection_status", "inspection_notes", "inspection_completed_at", "inspection_completed_by", "repairs_visible", "repairs_approved", "repairs_approved_at", "repairs_approved_by", "repair_status", "review_status", "completed_by_admin", "quality_check_status", "customer_notified", "odometer_reading", "next_service_due_km", "next_service_due_date", "is_fc_renewal", "estimated_delivery_date", "is_reopened", "reopen_reason", "reopened_at", "reopened_by", "rejection_reason", "rejected_at", "rejected_by") VALUES
	('602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', '73e87a2b-06fd-4867-9889-0ec6ee42d19a', NULL, 'Air Conditioning', 'No description provided', 'Pending Approval', 'Medium', 8500.00, NULL, '2026-02-09 10:32:28.022+00', '2026-02-09 10:36:50.832+00', '2026-02-09 10:32:28.188307+00', '2026-02-11 06:28:34.772987+00', 'Repair', false, NULL, NULL, NULL, true, '{"service_types":["Air Conditioning"],"total_sections":1,"reopened_at":"2026-02-11T06:04:14.031Z","original_reopen_reason":"problem checking"}', NULL, NULL, 'approved', NULL, NULL, NULL, false, false, NULL, NULL, 'approved', 'approved', false, 'completed', false, NULL, NULL, NULL, false, '2026-02-12 12:30:00+00', true, 'problem checking', NULL, NULL, NULL, NULL, NULL);


--
-- Data for Name: inventory_returns; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: inventory_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inventory_transactions" ("id", "item_id", "type", "quantity", "reference_id", "performed_by", "notes", "created_at") VALUES
	('0f6e8072-95d1-491f-9d4c-6d45d030446f', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'reservation', 5, 'f011654d-b8cb-409f-b22f-7d19bbe64b97', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Part request approved and reserved', '2026-01-29 07:16:07.094582+00'),
	('1df9b393-b2a8-410a-815d-276ea31c5502', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'issue', 1, 'f011654d-b8cb-409f-b22f-7d19bbe64b97', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-01-29 07:19:40.501148+00'),
	('93644893-c82e-4a3b-b60c-27c6375a8dab', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'adjustment', 4, 'f011654d-b8cb-409f-b22f-7d19bbe64b97', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Released 4 unissued reserved units back to stock', '2026-01-29 10:14:09.596672+00'),
	('129d9062-2d58-48e0-a1cc-9b74cbfb992b', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'reservation', 5, '37aa608e-9935-4f81-a860-b2ddb018f7da', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Part request approved and reserved', '2026-02-03 06:46:37.84118+00'),
	('84235ae3-8b07-4a5c-8801-932b152a2eab', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'adjustment', 5, '37aa608e-9935-4f81-a860-b2ddb018f7da', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Reservation cancelled: Not required anymore', '2026-02-03 09:02:43.603763+00'),
	('e5b20880-76e8-4821-b7a3-015838ff4167', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'reservation', 5, '9ba880ec-773a-4191-a482-27a28465863a', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Part request approved and reserved', '2026-02-03 09:03:13.511798+00'),
	('d51df17b-edd6-487f-b9c6-afbee85b9ddd', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '9ba880ec-773a-4191-a482-27a28465863a', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-03 09:07:19.519899+00'),
	('96ff1ea6-6cb2-4073-a95d-a54cc60739b1', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '9ba880ec-773a-4191-a482-27a28465863a', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-03 09:07:35.874255+00'),
	('cb495d42-3284-479c-9cd1-39c7f4b5f6d8', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '9ba880ec-773a-4191-a482-27a28465863a', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-03 09:10:48.590172+00'),
	('078aa6b9-2dea-4b2f-964e-1817a3a8317d', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '9ba880ec-773a-4191-a482-27a28465863a', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-03 09:10:55.821149+00'),
	('b60e45c6-3136-4dba-b292-8f4abd7cbe27', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '9ba880ec-773a-4191-a482-27a28465863a', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-03 09:12:05.707482+00'),
	('9b96db50-c3c9-4f26-a0e7-de7b4bb3cb9d', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'return', 2, 'e9c14faa-f79a-42fe-be3f-e919e24e832e', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Part return approved. Condition: unused', '2026-02-03 09:23:53.053227+00'),
	('9a8a1531-99b1-46b0-92e1-461697829b5a', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'reservation', 5, '94db0eda-23eb-4842-b3c0-d5941277f582', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Part request approved and reserved', '2026-02-04 09:11:57.408208+00'),
	('98ff02c9-88ff-4eb9-87eb-6000cfba7f34', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '94db0eda-23eb-4842-b3c0-d5941277f582', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-04 09:13:53.367915+00'),
	('79f925ac-8ee5-4cd9-96a7-1f40750fecdb', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '94db0eda-23eb-4842-b3c0-d5941277f582', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-04 09:14:03.98655+00'),
	('5806fb38-ad5c-41cc-86cc-454ab1d3c012', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '94db0eda-23eb-4842-b3c0-d5941277f582', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-04 09:14:47.481738+00'),
	('b24e5174-3c45-4e74-a806-359eca51c4fb', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '94db0eda-23eb-4842-b3c0-d5941277f582', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-04 09:14:53.500611+00'),
	('0269298a-d65d-494c-b719-e8b5fbe2be83', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'issue', 1, '94db0eda-23eb-4842-b3c0-d5941277f582', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-04 09:15:01.957232+00'),
	('5d8bdb1a-db05-4569-8b71-f07e9b3333ca', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'return', 2, '4804df9b-4100-4e78-a79f-047b4b308920', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Part return approved', '2026-02-04 09:18:02.961207+00'),
	('5ae0ba7d-0790-4dfa-a448-ab3a80579516', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'reservation', 5, 'b41042c9-479e-4d4b-bedb-96b98273741d', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Part request approved and reserved', '2026-02-05 08:02:47.953515+00'),
	('692e086d-4121-4534-820a-df262f08b574', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'issue', 1, 'b41042c9-479e-4d4b-bedb-96b98273741d', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Part scanned and issued to work order', '2026-02-05 08:06:07.502987+00'),
	('0a87716b-0ea2-4786-a119-b8162346ee5a', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'issue', 2, '040fb64b-a7df-4c45-a4ef-a1a70f779dbf', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Part scanned and issued to work order', '2026-02-05 12:08:51.166515+00'),
	('92660cc8-edd1-45a1-9602-667cc463fc3e', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'adjustment', 5, 'b41042c9-479e-4d4b-bedb-96b98273741d', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Reservation cancelled: Not required anymore', '2026-02-05 12:09:47.920147+00'),
	('6020c38c-eee0-444f-888f-578a753defe7', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'adjustment', 1, 'c32769dd-3f62-463c-a72d-51c24bf214e0', '96aed6d7-7168-4a7d-97be-920f6b58aecd', 'Reservation cancelled: Not required anymore', '2026-02-09 10:36:22.875412+00');


--
-- Data for Name: inventory_units; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."inventory_units" ("id", "inventory_id", "qr_code", "status", "batch_number", "created_at", "updated_at", "current_work_order_id", "issued_by") VALUES
	('bb23e1a7-59f1-4eda-b8b2-bee888b81748', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-8-ffe', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('ec805404-7fd3-48ef-9ce3-8ae94c7ed361', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-9-3e0', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('334eb682-b3e5-4c15-b9d0-51e70d75b41e', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-10-8e8', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('60fed822-a392-46ca-9d43-79b113bcdc35', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-11-6bd', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('bff82d02-aa6a-4a07-87f2-246ab09482ca', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-12-da9', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('6598f4e7-32e9-45bc-ad3c-823f842fd990', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-14-a45', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('1c23625c-b996-486b-9bf9-ac3085a55139', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-15-022', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('41da1607-41be-4a49-a2c8-7b07ffe7bef0', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-16-c0f', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('009261e6-edb7-48b0-9f3d-a732f0f49bd3', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-17-922', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('00748464-dce1-4492-ad37-fb9fa35e440b', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-18-16b', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('845dc6d1-3240-41cd-84e6-b47e6410b3db', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-19-7c7', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('b314bce0-9bc7-4c1e-9207-6db7add705ea', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-20-379', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 08:52:51.225217+00', NULL, NULL),
	('dc954d47-6d39-4778-a093-1046c9b55b34', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-3-be7', 'issued', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:06:07.502987+00', NULL, '2af3a41d-7dac-4065-a8f4-fb5e1256b401'),
	('11d51966-3851-4042-adad-2397ff2a3a6f', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-6-d16', 'issued', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-04 09:13:53.367915+00', NULL, '2af3a41d-7dac-4065-a8f4-fb5e1256b401'),
	('7fb85d5b-5551-4183-a087-f10e7f645155', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-7-d12', 'issued', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-04 09:14:03.98655+00', NULL, '2af3a41d-7dac-4065-a8f4-fb5e1256b401'),
	('3187f541-e3e0-4331-99ac-e1d4f85511cb', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-13-bf6', 'issued', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-04 09:15:01.957232+00', NULL, '2af3a41d-7dac-4065-a8f4-fb5e1256b401'),
	('5463d347-eef1-451f-9295-907e3b2944fc', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-5-d64', 'issued', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 09:12:05.707482+00', NULL, NULL),
	('d63ff66b-8689-438c-a183-b956a9adbc54', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-4-be1', 'issued', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 09:10:55.821149+00', NULL, NULL),
	('7ff857c1-505a-4152-ac38-ec744ba2030a', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-3-137', 'issued', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-03 09:10:48.590172+00', NULL, NULL),
	('7a24c415-7b06-4f2f-8cc5-de620cae0f00', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-2-4c4', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-04 09:18:02.961207+00', NULL, NULL),
	('f835f68b-adca-4823-ada2-c6d030729f48', 'e898021e-4d8d-44d1-bb54-086e22cf9047', 'ACC-9096-260203085251-1-c50', 'available', NULL, '2026-02-03 08:52:51.225217+00', '2026-02-04 09:18:02.961207+00', NULL, NULL),
	('1a1a812d-f30a-49dc-b758-23027be14a7a', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-1-ede', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('0de4be19-5b50-4f85-b56c-c5d37df4c6c3', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-2-e13', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('fe7e1e0f-885a-424b-8479-7ea3e7f54b43', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-4-96b', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('bc010ad5-0935-4653-8929-f66f4a10c32b', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-5-65a', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('71793a37-21a9-40dc-8610-b16395a0a1ba', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-6-565', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('2fed0b66-b6f3-4769-91fe-7c90dc319815', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-7-1ae', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('68bdd482-bd1a-4cd8-8ca2-27be935ad94e', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-8-166', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('11dd3974-7c6b-475d-afca-48770db858cc', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-9-55b', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('d67f6e46-a42c-4876-8cf6-91e5f369a173', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-10-7e2', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('8a2791d7-0bc7-4ad5-968f-a3d2a8759e4e', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-11-ad4', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('17649346-ba08-4349-a4e1-0c5710af8232', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-12-fe6', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('9cff79fd-8f77-452b-9737-7cf597c18734', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-13-058', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('823b48a6-e889-4b66-91f3-bfd8d9ca99df', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-14-83f', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('dd856178-fdf9-409b-97bc-8499e1c79e1b', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-15-bf6', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('ff94edbf-517d-4c47-b9db-9e788bdf683a', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-16-701', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('948606a6-eb20-4264-af98-3f9ee5621f50', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-17-797', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('db28be3f-da12-49c0-9b0d-9406aa9c887e', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-18-d4e', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('6213b403-a760-48c8-8266-8d5eed77cf27', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-19-2b1', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('c00a23ef-dc20-418d-ae60-6d1c38e8767c', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-20-105', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('3fff21e7-08eb-435f-b073-13f1ba9dd7a1', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-21-c4c', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('59d94bcb-1fcd-441c-829e-841525f5d346', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-22-ce0', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('6fdf28bb-8d49-4c8e-a0e0-87dd60eefef7', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-23-6a7', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('f4821211-f746-4df4-aa98-1d30110c4445', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-24-d3e', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('6b66f171-9242-4f85-b0fa-98ae555324cf', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-25-41a', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('7e450007-554c-4a02-accf-d41ffece984e', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-26-81b', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('7f92d985-969e-461f-a6e0-21c57d1907ec', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-27-4b7', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('d3cf9328-f193-4c72-971d-4ecb2305b9bd', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-28-274', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('4198025f-332b-416b-bbb7-4ae21b05cdba', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-29-b29', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('c2c11dcf-a786-41e2-95b8-7e1353030d28', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-30-6fc', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('75c8b50f-efee-4e32-accc-a2cdd0498a7e', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-31-cfb', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('c5c361d6-9a1c-439a-b90c-0ecec11cb8c3', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-32-545', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('c69f142d-f0d0-4caf-99b2-629203536eba', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-33-ab7', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('bc319a7f-4344-4695-9c66-18a0a9a4f654', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-34-c26', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('6a3ab5bb-7a7f-4cb4-9271-5c13cacc972a', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-35-980', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('c610be74-5e73-49bc-b7fb-728bc1e8a9bd', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-36-d06', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('c4e387e2-a6d7-4e4d-9442-b5945db49907', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-37-888', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('b426f7f0-ef4e-431a-bfb3-85db7f8f88f5', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-38-6cc', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('998d60d3-dfb2-4ef0-a8f8-343226e04d60', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-39-ac8', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('e1be339a-7330-41f3-841d-5cd7e6f8ed96', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-40-c38', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('c5180050-2ebc-498c-9543-af141dce27ad', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-41-862', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('24c8d1c2-829f-4eb4-98b6-0280a19e1b01', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-42-b8c', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('7bd7843b-69e3-43df-9661-5b42e23c40a8', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-43-ecd', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('d8f57997-4352-4136-a5f4-24d6b62310e6', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-44-44d', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('439baf28-52de-4ec0-be00-4b31518bd9b0', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-45-553', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('6dd25b85-3059-40d3-a868-b4686b15d4ba', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-46-78d', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('34a83293-3b1f-47d0-a662-ccb4c51f52f0', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-47-b56', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('ee79e8f3-809d-4662-9cd8-a32c96c2f3c7', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-48-142', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('b72592c6-63b2-49c2-b12c-55030b379510', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-49-639', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('07bc13ff-7644-4863-ba48-296ce01801ea', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-50-69a', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('f617a971-60a1-49a0-845d-0834f5af3d64', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-51-5b5', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('c578a283-c7f0-4c77-8094-29e3bbaa5ea5', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-52-413', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('a8ce12ca-4dd9-4547-bbad-47636eab9f78', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-53-9f1', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('045d781d-4839-46b3-997a-feda222b4469', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-54-915', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('07a9e7f3-57ac-4214-af57-2d81424ff768', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-55-dc1', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('1dc4152b-5705-4e98-b4d7-0b182d9b4af5', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-56-c66', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('223e6a20-e576-4a74-a94e-38841816a390', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-57-c61', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('a0d65d0f-f7e3-41fd-bdf4-c63a8abe667d', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-58-fd4', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('0f1bf2b2-e8c4-4ef8-8785-b7162bba889f', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-59-970', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('f7ee9e52-d777-4ff4-b41b-aee6afced13b', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-60-9af', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('1709efa3-3ba1-4652-aeb4-88cf62dbc486', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-61-96a', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('4a40c55f-0468-4008-b97e-155755f06014', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-62-707', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('7942297f-d6a8-4445-bb74-065af3b91718', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-63-448', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('a51a4bf9-c62e-4e31-9ec3-81dca4574178', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-64-e5a', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('5cada34b-4b25-40a2-9542-8918d013d909', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-65-6d2', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('90fa475f-48b5-4cd8-b249-3d39c9cb685b', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-66-e9e', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('50d2d188-5429-416c-8584-17c4f350f8e8', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-67-bba', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('a30ceefc-ac4c-4364-b446-9554328ad8a2', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-68-429', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('29c99b78-a734-43e8-91e2-0a58ce0071db', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-69-bf1', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('ed8eeb9c-a150-4501-94b1-d51c213e80a8', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-70-b6c', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('4e5ef2cb-7ee8-4d3b-b347-28b6b8d95670', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-71-4ec', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('6a15ee87-a654-47b3-a8c7-14414007435f', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-72-184', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('7b96dc0f-f035-43b4-b927-ea823809c9d0', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-73-bf0', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('2b40144d-ac2b-4f8e-ae5e-52c5db68d21a', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-74-e3d', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('e2259651-410d-4022-b39c-ad718151e745', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-75-098', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('5b915772-1080-49d1-9952-55ef06ed53d1', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-76-414', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('57a41cc0-def3-46ba-925c-b44730c9b869', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-77-129', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('1a4170c4-6ba2-4648-876d-f58ccf6d20cc', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-78-af1', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('e7c4da4e-9b2a-4d46-82e8-8e3c145a49cb', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-79-fd3', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('a4f6e845-aae3-413a-9bcc-cd54b5da19a1', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-80-44f', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('fa6bc6ec-183d-4e47-8117-6292b66ffbb0', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-81-8f3', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('69575ce6-55f9-4adc-bfb0-bc06cb7b0832', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-82-fdb', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('edc739c6-2fe2-4be0-b46e-25ae11502739', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-83-b21', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('f4d7986a-52f1-43d5-85af-e9fb7ed9d922', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-84-0fc', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('203458fb-e38e-4c30-b45b-8d7592c3dc1e', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-85-cca', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('f64abb03-0528-4eca-b206-52d33a24c617', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-86-2b0', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('826fba52-2e74-4e52-9c66-60f1d37b12a9', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-87-107', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('582ff27d-c520-441d-af43-d038523c6969', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-88-8dd', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('89cc0020-77df-4a11-aa3b-4f4053f81330', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-89-f18', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('056e9af5-bbb3-4214-aa9d-e8f79e262963', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-90-376', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('5ba8601d-1ad5-473b-b7e2-92917027fff9', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-91-063', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('a4db194c-06cc-43a2-983c-3b7d37441141', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-92-9fe', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('f720e6da-66e8-4844-921a-54df10d3d869', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-93-400', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('bfcf73cc-b358-4e8d-81cf-38da580452ab', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-94-269', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('04277d6b-e28e-424b-9f1d-9ae7691528f0', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-95-254', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('11a37625-591d-482e-ba6f-5d504ec36cc4', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-96-341', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('eef724e0-d06c-4acf-8a74-ef6c5285c3f9', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-97-5df', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('05260038-b009-4e5a-8b28-6a8504c1ddb8', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-98-199', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL),
	('808be142-a6ed-4243-90e3-325cadb9965f', 'a820fcb1-4c6c-4733-bc08-f7214d7d86b3', 'MEC-1488-260205080517-99-c5f', 'available', NULL, '2026-02-05 08:05:17.1922+00', '2026-02-05 08:05:17.1922+00', NULL, NULL);


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."invoices" ("id", "invoice_number", "customer_id", "work_order_id", "subtotal", "tax", "total", "status", "due_date", "paid_at", "created_at", "updated_at", "bill_number", "notes", "type", "quotation_number", "total_deductions") VALUES
	('5f24db0b-9fc9-4032-a596-8663716a1dc5', 'INV-1770633428792', 'ad664ff3-02aa-4c70-8ff1-f4ca61b20fda', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 8500.00, 1530.00, 10030.00, 'Paid', NULL, NULL, '2026-02-09 10:37:09.024299+00', '2026-02-09 12:21:58.7186+00', 12, NULL, 'invoice', NULL, 30.00);


--
-- Data for Name: profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."profiles" ("id", "email", "full_name", "phone", "created_at", "updated_at") VALUES
	('01f183b3-82cf-455c-a2dd-c9a22a0e7511', 'vishnu@gmail.com', 'vishnu', NULL, '2026-01-21 11:45:20.219039+00', '2026-01-21 11:45:20.219039+00'),
	('20b6700f-a5ce-43bc-ae2a-6af093f13b7e', 'tony@gmail.com', 'tony', '908776545', '2026-01-21 11:59:33.009208+00', '2026-01-21 11:59:33.19069+00'),
	('4a653d0e-92c9-4c58-a80e-44329f9402e4', 'ram@gmail.com', 'ram', '908776545', '2026-01-22 04:36:29.816014+00', '2026-01-22 04:36:30.168106+00');


--
-- Data for Name: work_order_services; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."work_order_services" ("id", "work_order_id", "service_type", "display_order", "estimated_duration", "estimated_cost", "actual_cost", "status", "started_at", "completed_at", "created_at", "updated_at", "approved_by", "approved_at", "customer_visible", "portal_updated_at", "calculated_price", "base_price_snapshot", "billing_price", "override_reason", "price_approved_by", "price_approved_at") VALUES
	('b79fdb61-c236-4fe9-8688-833bc583fcf2', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 'Air Conditioning', 0, NULL, 8500.00, 0.00, 'Pending Approval', NULL, NULL, '2026-02-09 10:32:28.638498+00', '2026-02-11 06:12:19.259033+00', NULL, NULL, false, NULL, 9420.00, 1439.00, 8500.00, NULL, NULL, NULL);


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."invoice_items" ("id", "invoice_id", "work_order_service_id", "description", "quantity", "unit_price", "total", "type", "created_at", "updated_at", "category", "hsn_code", "taxable_value", "gst_rate", "cgst_rate", "sgst_rate", "cgst_amount", "sgst_amount") VALUES
	('6c2d6236-83f6-483d-94a4-49a7751a57ea', '5f24db0b-9fc9-4032-a596-8663716a1dc5', 'b79fdb61-c236-4fe9-8688-833bc583fcf2', 'Leak Test', 1.00, 8500.00, 10030.00, 'service', '2026-02-09 10:37:09.617342+00', '2026-02-09 10:37:33.905667+00', 'Air Conditioning', NULL, 8500, 18, 9, 9, 765, 765);


--
-- Data for Name: part_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."part_requests" ("id", "work_order_id", "item_id", "requested_by", "requested_qty", "approved_qty", "issued_qty", "status", "notes", "created_at", "updated_at", "returned_qty", "approved_by") VALUES
	('c32769dd-3f62-463c-a72d-51c24bf214e0', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 'e898021e-4d8d-44d1-bb54-086e22cf9047', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 1, 1, 0, 'rejected', 'Not required anymore', '2026-02-09 10:35:40.758083+00', '2026-02-09 10:36:22.875412+00', 0, '96aed6d7-7168-4a7d-97be-920f6b58aecd');


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."payments" ("id", "invoice_id", "amount", "payment_method", "transaction_reference", "proof_url", "status", "admin_remarks", "verified_by", "verified_at", "created_at", "updated_at", "deduction_amount", "deduction_reason", "is_final_settlement") VALUES
	('f4b16b57-b3d6-4e15-979c-c217dce8b31d', '5f24db0b-9fc9-4032-a596-8663716a1dc5', 10000.00, 'Bank Transfer', NULL, 'https://qyfihvkpqrzuskjzqhzd.supabase.co/storage/v1/object/public/payment-proofs/proof-5f24db0b-9fc9-4032-a596-8663716a1dc5-1770633488969.png', 'approved', NULL, '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-09 10:38:52.973+00', '2026-02-09 10:38:11.669597+00', '2026-02-09 10:38:53.110162+00', 30.00, 'Retention', false);


--
-- Data for Name: payment_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."payment_links" ("id", "payment_id", "invoice_id", "amount_applied", "created_at") VALUES
	('2a18c621-d76f-4f53-a1ba-5982f23f6fb0', 'f4b16b57-b3d6-4e15-979c-c217dce8b31d', '5f24db0b-9fc9-4032-a596-8663716a1dc5', 10000.00, '2026-02-09 10:38:11.971892+00');


--
-- Data for Name: payout_adjustments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."payout_adjustments" ("id", "employee_id", "payout_id", "attendance_id", "amount", "description", "is_processed", "processed_payout_id", "created_at") VALUES
	('c0766cee-2df1-438c-8de2-b1373d9be719', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'e3c40d21-2b8f-4f19-92af-68eea56705ec', 'f6884921-ae2d-4b0a-ab92-d8e510c989d7', -45.00, 'Correction for 2026-01-30: present -> half-day', true, NULL, '2026-01-30 10:44:35.692474+00'),
	('a487c12f-75ff-4c51-bd5c-03f3e0e96d4c', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'e3c40d21-2b8f-4f19-92af-68eea56705ec', 'f6884921-ae2d-4b0a-ab92-d8e510c989d7', 45.00, 'Correction for 2026-01-30: half-day -> present', true, NULL, '2026-01-30 10:45:06.596069+00'),
	('daf8be02-c972-416d-9f6a-4b0acca0c934', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'e3c40d21-2b8f-4f19-92af-68eea56705ec', 'f6884921-ae2d-4b0a-ab92-d8e510c989d7', -45.00, 'Correction for 2026-01-30: present -> half-day', true, NULL, '2026-01-30 10:49:17.172028+00'),
	('e50b2131-3b26-452e-b944-76a647487c41', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'e3c40d21-2b8f-4f19-92af-68eea56705ec', 'f6884921-ae2d-4b0a-ab92-d8e510c989d7', 45.00, 'Correction for 2026-01-30: half-day -> present', true, NULL, '2026-01-30 10:54:12.184172+00');


--
-- Data for Name: service_types; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."service_types" ("id", "name", "created_at", "category", "description", "base_price", "estimated_duration", "tax_applicable", "is_active", "required_fields", "inventory_categories", "last_updated_by", "updated_at", "is_fc_exclusive", "hsn_code", "sac_code") VALUES
	('4e17a196-e02f-431d-839c-146d2ddf365c', 'Tinker Work', '2026-01-27 06:11:42.106858+00', 'General', NULL, 0, NULL, true, true, '{}', '{}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('551442c3-5e8c-4414-811e-d6a72904d752', 'Engine Overhaul', '2026-01-27 06:11:42.106858+00', 'General', NULL, 0, NULL, true, true, '{}', '{}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('3badb225-df19-4c39-ba31-f9844c4ae536', 'Transmission Repair', '2026-01-27 06:11:42.106858+00', 'General', NULL, 0, NULL, true, true, '{}', '{}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('40b1171f-396f-44e9-82f1-dfe37e0167fe', 'Brake System', '2026-01-27 06:11:42.106858+00', 'General', NULL, 0, NULL, true, true, '{}', '{}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('477e6f85-14b7-47f5-adf5-1146557fca3f', 'Suspension Work', '2026-01-27 06:11:42.106858+00', 'General', NULL, 0, NULL, true, true, '{}', '{}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('af65b8d8-fa84-43c9-b32c-94d1cde932ab', 'Custom Modification', '2026-01-27 06:11:42.106858+00', 'General', NULL, 0, NULL, true, true, '{}', '{}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('f5b31e7b-cf36-43cb-b294-a4dbe7deb325', 'FC work', '2026-01-27 06:12:40.517385+00', 'General', NULL, 0, NULL, true, true, '{}', '{}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('8dbab7ad-fec1-4c53-a7c6-934de16ead1c', 'Full FC work', '2026-01-27 06:46:06.944207+00', 'General', NULL, 0, NULL, true, true, '{}', '{}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('00dca147-6271-4374-aca1-e603f80d3b75', 'Mechanical Repair', '2026-01-27 06:11:42.106858+00', 'Mechanical', 'Standard mechanical repairs and diagnostics', 1500, '2-4 hours', true, true, '{vehicle_id,service_type,description,estimated_cost}', '{"Mechanical Parts",Filters,Fluids,Bearings,Seals}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('b81998dc-7e50-48c2-a7b4-1b8732b88aec', 'Painting', '2026-01-27 06:11:42.106858+00', 'Bodywork', 'Full body or partial painting services', 3000, '2-5 days', true, true, '{vehicle_id,service_type,description,color_code,estimated_cost}', '{"Paint Supplies","Clear Coat",Primers,Sandpaper,Masking}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('c034beed-8e4f-4021-a0f1-c9a11498b969', 'Electrical Work', '2026-01-27 06:11:42.106858+00', 'Electrical', 'A/C, wiring, and electronic system repairs', 1200, '1-4 hours', true, true, '{vehicle_id,service_type,description,estimated_cost}', '{"Electrical Parts",Wiring,Fuses,Relays,Sensors}', NULL, '2026-02-02 06:48:14.783572+00', false, NULL, NULL),
	('597367e1-b036-4a8b-a47e-42feaa20dbd2', 'Body Building', '2026-01-27 06:11:42.106858+00', 'Bodywork', 'Major body modifications and frame work', 0, '3-7 days', true, true, '{vehicle_id,service_type,description,estimated_cost}', '{"Body Parts","Sheet Metal","Paint Supplies","Welding Consumables"}', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-02 06:53:10.825882+00', false, NULL, NULL),
	('8edc6127-1bd1-46a7-bfac-337805c33dad', 'Air Conditioning', '2026-01-27 06:11:42.106858+00', 'General', NULL, 1439, NULL, true, true, '{}', '{}', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-05 06:55:48.997974+00', false, NULL, NULL),
	('97e690b3-37ba-4530-8f53-97b4c24ad1cc', 'FC - Structural Inspection', '2026-02-04 06:03:28.444381+00', 'Mechanical', 'Chassis and frame inspection for FC certification', 2500, '4 hours', true, true, '{}', '{}', NULL, '2026-02-04 06:03:28.444381+00', true, NULL, NULL),
	('7537630c-8033-49e5-b762-b54fed8ad4b1', 'FC - Electrical Wiring Check', '2026-02-04 06:03:28.444381+00', 'Electrical', 'Full wiring harness inspection and tagging', 3500, '6 hours', true, true, '{}', '{}', NULL, '2026-02-04 06:03:28.444381+00', true, NULL, NULL),
	('514306aa-cc8b-4b95-8769-1c9b3baf4473', 'FC - Tinker Work', '2026-02-04 06:03:28.444381+00', 'Bodywork', 'Patchwork and dent removal for FC', 5000, '3-5 days', true, true, '{}', '{}', NULL, '2026-02-04 06:03:28.444381+00', true, NULL, NULL),
	('aec3c490-338e-4cdd-96e2-70f482342935', 'FC - Brake Overhaul', '2026-02-04 06:03:28.444381+00', 'Painting', 'Complete brake system overhaul for FC compliance', 900, '1 day', true, true, '{}', '{}', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-04 06:36:10.676867+00', true, NULL, NULL),
	('48063104-8b0a-4e46-96e8-1b1d7531bda4', 'FC - Full Painting', '2026-02-04 06:03:28.444381+00', 'Painting', 'Complete body painting for FC renewal', 900, '5-7 days', true, true, '{}', '{}', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-04 06:38:16.057062+00', true, NULL, NULL);


--
-- Data for Name: task_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."task_templates" ("id", "service_type_id", "name", "description", "priority", "is_active", "created_at", "updated_at", "last_updated_by", "price", "hsn_code", "sac_code") VALUES
	('a12e2ff7-4121-41ce-83a1-b177821cde19', '00dca147-6271-4374-aca1-e603f80d3b75', 'Filter Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('50a0c2ba-d659-4fe9-9c9a-98384f80b1ed', '00dca147-6271-4374-aca1-e603f80d3b75', 'Spark Plug Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('fedced8b-f2a1-40fa-8a8e-68cc5913400c', '00dca147-6271-4374-aca1-e603f80d3b75', 'General Inspection', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('ee0f67d5-2cff-40fe-a986-3be773dc607f', '00dca147-6271-4374-aca1-e603f80d3b75', 'Fluid Top-up', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('79136bfd-aea1-489e-b21a-a141b1a482ef', '597367e1-b036-4a8b-a47e-42feaa20dbd2', 'Dent Removal', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('c461ee04-ec33-4483-aa6a-2b0c1eed406b', '597367e1-b036-4a8b-a47e-42feaa20dbd2', 'Frame Straightening', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('2aeb3160-9c6f-4309-96a8-8fc235d88b57', '597367e1-b036-4a8b-a47e-42feaa20dbd2', 'Welding', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('e2d3311d-7ec4-4bd1-b842-b0f5dfc80374', '597367e1-b036-4a8b-a47e-42feaa20dbd2', 'Part Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('09a51ac0-bc50-40cc-bd46-60b80d41155b', 'b81998dc-7e50-48c2-a7b4-1b8732b88aec', 'Touch-up', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('6a31a785-8370-420c-beda-e673c11404a5', 'b81998dc-7e50-48c2-a7b4-1b8732b88aec', 'Polishing', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('01b8f0e6-f7d6-4c1f-ab34-757372fafcc6', 'b81998dc-7e50-48c2-a7b4-1b8732b88aec', 'Sanding', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('fa9b74e0-5b48-47b3-b6c8-f55977f57926', 'b81998dc-7e50-48c2-a7b4-1b8732b88aec', 'Clear Coat Application', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('60e1a5ee-308a-4156-b0c2-39f870bd3446', 'c034beed-8e4f-4021-a0f1-c9a11498b969', 'Battery Check', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('860bdd98-b1c0-4fca-8c18-4cc8533515f4', 'c034beed-8e4f-4021-a0f1-c9a11498b969', 'Wiring Repair', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('27ff789f-f6b0-40df-b3cd-c27c8e2e4bf7', 'c034beed-8e4f-4021-a0f1-c9a11498b969', 'Alternator Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('a018a654-5dff-43c1-9f60-5a80525cb7b2', 'c034beed-8e4f-4021-a0f1-c9a11498b969', 'Fuse Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('7edc8f27-c99c-4a85-b03a-d03e65d86e8e', 'c034beed-8e4f-4021-a0f1-c9a11498b969', 'Diagnostic Scan', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('55f76cdb-efb3-4574-b111-a14b42f02593', '4e17a196-e02f-431d-839c-146d2ddf365c', 'Lock Repair', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('b3d480f8-29b9-4855-87df-4ebda11fbf17', '4e17a196-e02f-431d-839c-146d2ddf365c', 'Hinge Adjustment', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('25581a00-a4e5-40e6-ab8f-46ff2da7d5f1', '4e17a196-e02f-431d-839c-146d2ddf365c', 'Window Mechanism Repair', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('523bbdbf-bb0d-4d61-8407-cb9a30396cec', '4e17a196-e02f-431d-839c-146d2ddf365c', 'Handle Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('66d5c028-1c41-4690-bc28-e042f99307e7', '551442c3-5e8c-4414-811e-d6a72904d752', 'Head Gasket Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('5647d8f9-b179-4032-ae71-6c95c808055d', '551442c3-5e8c-4414-811e-d6a72904d752', 'Piston Ring Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('8cd1d869-df84-4df9-882e-c86c5e8ff85d', '551442c3-5e8c-4414-811e-d6a72904d752', 'Valve Clearance Adjustment', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('5e3b063d-2948-4e6c-8f16-3d5f89f035f8', '551442c3-5e8c-4414-811e-d6a72904d752', 'Timing Belt Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('0379c439-ac75-48d7-8b25-88a5622451de', '3badb225-df19-4c39-ba31-f9844c4ae536', 'Clutch Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('bbf90997-aeaa-42c4-9245-14c892605a5f', '3badb225-df19-4c39-ba31-f9844c4ae536', 'Fluid Flush', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('d42bb772-8f4a-4c0f-932e-b87864adbb33', '3badb225-df19-4c39-ba31-f9844c4ae536', 'Gear Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('f5d6c9e1-bcb7-4fd1-a519-637f0e186a92', '3badb225-df19-4c39-ba31-f9844c4ae536', 'Linkage Adjustment', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('48a74347-bafb-4c4b-a58b-861e8671f9ed', '40b1171f-396f-44e9-82f1-dfe37e0167fe', 'Pad Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('c2806e47-8c13-402d-9de1-ffe261e1e632', '40b1171f-396f-44e9-82f1-dfe37e0167fe', 'Rotor Resurfacing/Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('38677ae8-5eb2-4139-a2bb-1827ead92a45', '40b1171f-396f-44e9-82f1-dfe37e0167fe', 'Bleeding', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('a7bd6ce3-7882-4f04-9142-b42a1a9955ad', '40b1171f-396f-44e9-82f1-dfe37e0167fe', 'Caliper Service', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('c86977a5-16f2-4b10-ba5d-91dc0058441f', '477e6f85-14b7-47f5-adf5-1146557fca3f', 'Shock Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('701fa656-7ead-4d06-bd04-f8509414c9b7', '477e6f85-14b7-47f5-adf5-1146557fca3f', 'Alignment', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('f3ee8104-6b13-40ee-b97c-2d4d5e9682bb', '477e6f85-14b7-47f5-adf5-1146557fca3f', 'Bushing Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('9fcbaf73-b598-4dc2-a1f1-daadebf18121', '477e6f85-14b7-47f5-adf5-1146557fca3f', 'Ball Joint Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('dd11ec2a-ced6-41bd-bfe0-003dcce34035', '8edc6127-1bd1-46a7-bfac-337805c33dad', 'Compressor Service', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('bee7c021-611d-4fbd-abbc-6cce4b3c8964', 'af65b8d8-fa84-43c9-b32c-94d1cde932ab', 'Installation', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('a5dfc765-0514-41ba-8dd5-89b9d1a52dd5', 'af65b8d8-fa84-43c9-b32c-94d1cde932ab', 'Wiring', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('215cbef8-2a6f-4c0f-9805-6783b5630d2b', 'af65b8d8-fa84-43c9-b32c-94d1cde932ab', 'Fabrication', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('350874d6-b1c2-43cc-830a-c7cd0a67e372', 'af65b8d8-fa84-43c9-b32c-94d1cde932ab', 'Testing', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-01-27 06:22:01.970269+00', NULL, 0.00, NULL, NULL),
	('8e3328c4-8299-4363-81a0-7898fb7dfdc4', '8edc6127-1bd1-46a7-bfac-337805c33dad', 'Filter Replacement', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-02-05 06:55:37.629969+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', 0.00, '7888', NULL),
	('2fabb86e-8844-463d-90c9-974049e99210', '8edc6127-1bd1-46a7-bfac-337805c33dad', 'Gas Top-up', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-02-05 06:55:42.384234+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', 900.00, '6777', NULL),
	('7c5e7743-3afe-43b9-9ebe-78ed85e3847f', '8edc6127-1bd1-46a7-bfac-337805c33dad', 'Leak Test', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-02-05 06:55:45.53543+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', 450.00, '555', NULL),
	('007272b4-9b76-4d92-a994-24a30fad2fa7', '00dca147-6271-4374-aca1-e603f80d3b75', 'Oil Change', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-02-02 06:50:01.728585+00', NULL, 500.00, NULL, NULL),
	('b36b79cc-9e88-4b16-8ebf-6298c25791b1', '597367e1-b036-4a8b-a47e-42feaa20dbd2', 'Panel Beating', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-02-02 06:50:01.728585+00', NULL, 1500.00, NULL, NULL),
	('e14e6699-39f3-43ac-a81a-32b83978e044', 'b81998dc-7e50-48c2-a7b4-1b8732b88aec', 'Full Body Paint', NULL, 'Medium', true, '2026-01-27 06:22:01.970269+00', '2026-02-02 06:50:01.728585+00', NULL, 2000.00, NULL, NULL),
	('5abe027e-2271-406a-b983-ab940e8c6bd1', '48063104-8b0a-4e46-96e8-1b1d7531bda4', 'Full painting', NULL, 'Medium', true, '2026-02-04 06:37:56.786265+00', '2026-02-04 06:37:56.786265+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', 900.00, NULL, NULL),
	('adea3a07-10e0-468d-a072-22958f9d6870', '8edc6127-1bd1-46a7-bfac-337805c33dad', 'test4', NULL, 'Medium', true, '2026-02-02 12:23:16.934113+00', '2026-02-05 06:55:48.895345+00', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', 89.00, '4656', NULL),
	('274fae14-c766-4fb5-949e-b5e1ebc78ff2', '00dca147-6271-4374-aca1-e603f80d3b75', 'Filter Replacement', NULL, 'Medium', true, '2026-02-02 06:48:14.783572+00', '2026-02-02 06:48:14.783572+00', NULL, 0.00, NULL, NULL),
	('c0f6522d-3e4f-4878-9ac7-5d7acc1b4d31', '00dca147-6271-4374-aca1-e603f80d3b75', 'Spark Plug Replacement', NULL, 'Medium', true, '2026-02-02 06:48:14.783572+00', '2026-02-02 06:48:14.783572+00', NULL, 0.00, NULL, NULL),
	('aaf5a576-bf84-4303-a442-77424fd50be8', '00dca147-6271-4374-aca1-e603f80d3b75', 'General Inspection', NULL, 'Medium', true, '2026-02-02 06:48:14.783572+00', '2026-02-02 06:48:14.783572+00', NULL, 0.00, NULL, NULL),
	('fa36e5e0-3b64-4c8e-9599-6d52ee819a46', '00dca147-6271-4374-aca1-e603f80d3b75', 'Fluid Top-up', NULL, 'Medium', true, '2026-02-02 06:48:14.783572+00', '2026-02-02 06:48:14.783572+00', NULL, 0.00, NULL, NULL),
	('8d3fa7ff-f580-4b8c-9624-82599813924c', '00dca147-6271-4374-aca1-e603f80d3b75', 'Oil Change', NULL, 'Medium', true, '2026-02-02 06:48:14.783572+00', '2026-02-02 06:50:01.728585+00', NULL, 500.00, NULL, NULL);


--
-- Data for Name: pricing_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."pricing_rules" ("id", "name", "service_type_id", "vehicle_category_id", "vehicle_type_id", "customer_id", "modifier_type", "modifier_value", "priority", "is_active", "created_at", "updated_at", "task_template_id") VALUES
	('167dbe3a-8497-4d8f-90f7-941589247cd0', 'Alternator Replacement - Heavy Machinery Override', 'c034beed-8e4f-4021-a0f1-c9a11498b969', '80d5f3cc-c6f5-428d-b3d9-4ff7bfc26ee3', NULL, NULL, 'override', 90.00, 10, true, '2026-02-04 04:05:28.178952+00', '2026-02-04 04:05:28.178952+00', '27ff789f-f6b0-40df-b3cd-c27c8e2e4bf7'),
	('dce45da5-0d6a-4efa-bcd5-f993148f136d', 'Wiring Repair - Heavy Machinery Override', 'c034beed-8e4f-4021-a0f1-c9a11498b969', '80d5f3cc-c6f5-428d-b3d9-4ff7bfc26ee3', NULL, NULL, 'override', 80.00, 10, true, '2026-02-04 04:15:36.691369+00', '2026-02-04 04:15:36.691369+00', '860bdd98-b1c0-4fca-8c18-4cc8533515f4'),
	('b493dc08-6fb5-4516-a5c3-02af9a473918', 'Battery Check - Heavy Machinery Override', 'c034beed-8e4f-4021-a0f1-c9a11498b969', '80d5f3cc-c6f5-428d-b3d9-4ff7bfc26ee3', NULL, NULL, 'override', 90.00, 10, true, '2026-02-04 04:05:07.059934+00', '2026-02-04 04:05:07.059934+00', '60e1a5ee-308a-4156-b0c2-39f870bd3446'),
	('e98e8363-44f3-4f93-a83d-d5d496b63f9d', 'Full painting - Truck', '48063104-8b0a-4e46-96e8-1b1d7531bda4', '0c3395fc-33ae-4174-83d9-9311f347e3c4', NULL, NULL, 'fixed', 15000.00, 10, true, '2026-02-04 06:38:16.263394+00', '2026-02-04 06:38:16.263394+00', '5abe027e-2271-406a-b983-ab940e8c6bd1'),
	('522656f8-c122-4e1a-90c0-7fade37e5bf3', 'Leak Test - Truck', '8edc6127-1bd1-46a7-bfac-337805c33dad', '0c3395fc-33ae-4174-83d9-9311f347e3c4', NULL, NULL, 'override', 8500.00, 10, true, '2026-02-05 06:55:49.250016+00', '2026-02-05 06:55:49.250016+00', '7c5e7743-3afe-43b9-9ebe-78ed85e3847f'),
	('8590e859-644d-4371-8d89-3499b9f8ea54', 'Gas Top-up - Heavy Machinery', '8edc6127-1bd1-46a7-bfac-337805c33dad', '80d5f3cc-c6f5-428d-b3d9-4ff7bfc26ee3', NULL, NULL, 'fixed', 10000.00, 10, true, '2026-02-05 06:55:49.250016+00', '2026-02-05 06:55:49.250016+00', '2fabb86e-8844-463d-90c9-974049e99210'),
	('cd1a5c64-f363-4e95-bbfb-cc1d89b8791f', 'test2 - Truck Override', '8edc6127-1bd1-46a7-bfac-337805c33dad', '0c3395fc-33ae-4174-83d9-9311f347e3c4', NULL, NULL, 'override', 20.00, 10, true, '2026-02-05 06:55:49.250016+00', '2026-02-05 06:55:49.250016+00', 'adea3a07-10e0-468d-a072-22958f9d6870'),
	('8b627d94-f58a-4b75-8464-8ff9afa41fbb', 'test2 - Heavy Machinery Override', '8edc6127-1bd1-46a7-bfac-337805c33dad', '80d5f3cc-c6f5-428d-b3d9-4ff7bfc26ee3', NULL, NULL, 'override', 90.00, 10, true, '2026-02-05 06:55:49.250016+00', '2026-02-05 06:55:49.250016+00', 'adea3a07-10e0-468d-a072-22958f9d6870');


--
-- Data for Name: repair_task_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."repair_task_history" ("id", "task_id", "action", "performed_by", "notes", "created_at") VALUES
	('9beba951-25f7-452a-9275-8f1704778b31', '2be7f74d-fa46-49bb-8d99-276b8bf46f80', 'completed', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Task completed', '2026-01-23 06:55:57.386893+00'),
	('5d449cec-9b4b-40c0-a5a4-14d3cb766f60', '1d275000-5549-4cbb-a7e3-b3e1a2b1c0e2', 'completed', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Task completed', '2026-01-23 06:59:20.830293+00'),
	('9702cb09-258a-45c6-88aa-b49ece9df343', 'f6ae862f-0032-4172-88b4-f28b9209e02b', 'completed', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Task completed', '2026-01-23 06:59:23.711118+00'),
	('9caeb861-4bf0-4dc1-86bf-7a65bab9bc6f', 'cd88e38a-3f60-4bfd-91cc-499c3d6f5afc', 'completed', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Task completed', '2026-01-23 06:59:26.418569+00'),
	('76fc1d5a-0828-41ce-a547-1807dd5ad6d6', '6ddca8cb-679d-4712-a366-4f9d0afa9e4a', 'completed', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'Task completed', '2026-01-23 06:59:28.604351+00');


--
-- Data for Name: repair_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: service_categories; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."service_categories" ("id", "name", "description", "created_at") VALUES
	('26c5ca3f-473b-4285-bce3-8a2794547fc5', 'Mechanical', NULL, '2026-02-04 06:28:56.820594+00'),
	('56333c7c-ca3e-4b78-8da9-da0dd091e20b', 'Bodywork', NULL, '2026-02-04 06:28:56.820594+00'),
	('b6e7ebdc-8083-4054-8ed3-4632233e8cba', 'Electrical', NULL, '2026-02-04 06:28:56.820594+00'),
	('46879534-3d5f-4061-aab9-a7f2fcc222f5', 'General', NULL, '2026-02-04 06:28:56.820594+00'),
	('b39fb581-8d48-4f34-a24f-63f389c91eea', 'Inspection', NULL, '2026-02-04 06:28:56.820594+00'),
	('c0c8f0c4-4ace-4854-9436-d5af2c1ef691', 'Custom', NULL, '2026-02-04 06:28:56.820594+00'),
	('084e1c5d-cb2e-4d73-ace2-c1c2ed776563', 'Painting', NULL, '2026-02-04 06:29:30.033484+00');


--
-- Data for Name: service_history; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."service_history" ("id", "vehicle_id", "work_order_id", "service_type", "service_description", "work_summary", "status", "service_date", "delivery_date", "approved_by", "notes", "created_at") VALUES
	('a6112715-877a-47bd-a5d5-446aff0eefda', '73e87a2b-06fd-4867-9889-0ec6ee42d19a', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 'Air Conditioning', 'Air Conditioning service', 'Leak Test', 'Completed', '2026-02-09 10:32:28.188307+00', NULL, NULL, NULL, '2026-02-09 10:36:50.907865+00');


--
-- Data for Name: service_vehicle_applicability; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."user_roles" ("id", "user_id", "role", "created_at") VALUES
	('306042bf-0720-48e4-93dc-1dc868fff7dc', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', 'admin', '2026-01-21 11:46:52.134131+00'),
	('c8841a71-5160-4512-9b7e-881c18a91abd', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', 'customer', '2026-01-21 11:59:33.09978+00'),
	('224e2fc7-ca7c-4b94-88ee-2b6e18954dd4', '4a653d0e-92c9-4c58-a80e-44329f9402e4', 'staff', '2026-01-22 04:36:30.056663+00');


--
-- Data for Name: vehicle_fc_history; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: work_order_approvals; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: work_order_assignments; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."work_order_assignments" ("id", "work_order_id", "employee_id", "status", "assigned_at", "accepted_at", "completed_at", "notes", "created_at", "updated_at", "approved_by", "approved_at", "approval_notes") VALUES
	('e7b1a5f2-42ef-4bbf-b593-811a85171a55', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', 'assigned', '2026-02-09 10:32:29.424368+00', NULL, NULL, 'Assigned to Air Conditioning', '2026-02-09 10:32:29.424368+00', '2026-02-11 06:04:15.223934+00', NULL, NULL, NULL);


--
-- Data for Name: work_order_parts; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: work_order_service_employees; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."work_order_service_employees" ("id", "service_id", "employee_id", "role", "status", "assigned_at", "accepted_at", "completed_at", "notes", "created_at", "updated_at", "approved_by", "approved_at", "approval_notes", "queue_position", "accepted_by") VALUES
	('b02bb32b-65f7-4baf-8043-41fd51bb676d', 'b79fdb61-c236-4fe9-8688-833bc583fcf2', '2af3a41d-7dac-4065-a8f4-fb5e1256b401', NULL, 'Accepted', '2026-02-11 06:04:15.078969+00', NULL, NULL, NULL, '2026-02-11 06:04:15.078969+00', '2026-02-11 06:04:15.078969+00', NULL, NULL, NULL, 1, NULL);


--
-- Data for Name: work_order_service_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--



--
-- Data for Name: work_order_stages; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."work_order_stages" ("id", "work_order_id", "stage", "status", "started_at", "completed_at", "notes", "completed_by", "created_at", "updated_at") VALUES
	('b782760a-70df-4e5e-85a5-48137fd85a12', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 'Inspection', 'completed', NULL, '2026-02-09 10:35:20.043+00', NULL, NULL, '2026-02-09 10:32:28.188307+00', '2026-02-09 10:35:20.145903+00'),
	('15d381b8-8957-4cc6-99d4-375ec8d69345', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 'Delivery', 'pending', '2026-02-09 10:36:47.169+00', NULL, NULL, NULL, '2026-02-09 10:32:28.188307+00', '2026-02-11 06:24:15.692896+00'),
	('77ae9765-f3a1-4e05-8aca-a9729f762517', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 'Review', 'completed', NULL, '2026-02-11 06:27:51.598+00', NULL, NULL, '2026-02-09 10:32:28.188307+00', '2026-02-11 06:27:51.677153+00'),
	('9129c500-06a0-484c-a4ca-fb7a8d4a308f', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 'Quality Check', 'completed', NULL, '2026-02-11 06:28:05.537+00', NULL, NULL, '2026-02-09 10:32:28.188307+00', '2026-02-11 06:28:05.616824+00'),
	('4c4a5619-bcc2-426b-a1ad-482695d0b9d9', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 'Repair', 'completed', NULL, '2026-02-11 06:28:34.807+00', NULL, NULL, '2026-02-09 10:32:28.188307+00', '2026-02-11 06:28:34.89154+00');


--
-- Data for Name: work_order_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO "public"."work_order_tasks" ("id", "work_order_id", "task_name", "task_type", "assigned_employee_id", "completed", "completed_at", "created_at", "updated_at", "service_id", "description", "notes", "is_predefined", "sequence_order", "completed_by", "price", "is_rejected", "rejection_reason", "rejected_at") VALUES
	('99d91cc4-6705-403b-b52c-c91df397eb3a', '602b6d3c-3dc0-47a8-82ae-6edc70f4ec5c', 'Leak Test', 'repair', NULL, true, '2026-02-11 06:12:15.026553+00', '2026-02-11 06:04:14.762332+00', '2026-02-11 06:12:15.026553+00', 'b79fdb61-c236-4fe9-8688-833bc583fcf2', NULL, NULL, true, 0, '4a653d0e-92c9-4c58-a80e-44329f9402e4', 8500.00, false, NULL, NULL);


--
-- Data for Name: buckets; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES
	('payment-proofs', 'payment-proofs', NULL, '2026-01-27 12:19:44.330527+00', '2026-01-27 12:19:44.330527+00', true, false, NULL, NULL, NULL, 'STANDARD'),
	('qr-codes', 'qr-codes', NULL, '2026-01-27 12:19:44.330527+00', '2026-01-27 12:19:44.330527+00', true, false, NULL, NULL, NULL, 'STANDARD'),
	('public-assets', 'public-assets', NULL, '2026-01-30 12:33:45.431959+00', '2026-01-30 12:33:45.431959+00', true, false, NULL, NULL, NULL, 'STANDARD');


--
-- Data for Name: buckets_analytics; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: buckets_vectors; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: objects; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--

INSERT INTO "storage"."objects" ("id", "bucket_id", "name", "owner", "created_at", "updated_at", "last_accessed_at", "metadata", "version", "owner_id", "user_metadata") VALUES
	('e483eda0-a96b-43ac-b83b-38ef27d1a400', 'payment-proofs', 'proof-1cda4564-42bc-44ec-8dc1-627d650e6b50-1769516396949.png', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-01-27 12:19:57.298253+00', '2026-01-27 12:19:57.298253+00', '2026-01-27 12:19:57.298253+00', '{"eTag": "\"549d5f0de91cb98cae63350ea7b458bb\"", "size": 544576, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-27T12:19:58.000Z", "contentLength": 544576, "httpStatusCode": 200}', '934e63e4-26f4-4361-b3db-6f434018a384', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{}'),
	('440fb44e-fb40-4c59-b16c-90b25bdfd74f', 'qr-codes', 'qr-code-1769600237809.png', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-28 11:37:18.206369+00', '2026-01-28 11:37:18.206369+00', '2026-01-28 11:37:18.206369+00', '{"eTag": "\"4a0183a63e97bf968beef4a072cd7edf\"", "size": 38496, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-28T11:37:19.000Z", "contentLength": 38496, "httpStatusCode": 200}', 'a4a70cde-43bc-4c70-8f1e-b56de780b88a', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '{}'),
	('e508020e-d9e6-4531-860c-100c2e570ef5', 'qr-codes', 'qr-code-1769601168914.png', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-01-28 11:52:49.257119+00', '2026-01-28 11:52:49.257119+00', '2026-01-28 11:52:49.257119+00', '{"eTag": "\"4a0183a63e97bf968beef4a072cd7edf\"", "size": 38496, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-28T11:52:50.000Z", "contentLength": 38496, "httpStatusCode": 200}', 'deaa1b42-9891-42b2-b4b3-86b4531bc9bd', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '{}'),
	('7f66c952-fc24-4556-b949-642e4c49f1bb', 'payment-proofs', 'proof-47d6f328-d877-4822-9072-79846d0e7b5f-1769602122405.png', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-01-28 12:08:43.00604+00', '2026-01-28 12:08:43.00604+00', '2026-01-28 12:08:43.00604+00', '{"eTag": "\"549d5f0de91cb98cae63350ea7b458bb\"", "size": 544576, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-28T12:08:43.000Z", "contentLength": 544576, "httpStatusCode": 200}', 'c72ab610-a6c5-47ce-8a96-0d0793918119', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{}'),
	('7a948310-aeb6-4608-b7dd-641390be6b59', 'payment-proofs', 'proof-a8ca5948-7c6b-40d6-b198-c6cf0e206a41-1769661681187.png', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-01-29 04:41:21.807593+00', '2026-01-29 04:41:21.807593+00', '2026-01-29 04:41:21.807593+00', '{"eTag": "\"549d5f0de91cb98cae63350ea7b458bb\"", "size": 544576, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-01-29T04:41:22.000Z", "contentLength": 544576, "httpStatusCode": 200}', '386e4ec1-42c0-4a06-99aa-e08aaff70332', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{}'),
	('07f61ea9-fb7e-4a0c-a90d-b6ee8f6a7fbb', 'public-assets', 'logo-1770007899394.png', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-02 04:51:39.816911+00', '2026-02-02 04:51:39.816911+00', '2026-02-02 04:51:39.816911+00', '{"eTag": "\"4a0183a63e97bf968beef4a072cd7edf\"", "size": 38496, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-02-02T04:51:40.000Z", "contentLength": 38496, "httpStatusCode": 200}', 'c4d4f718-07fa-4653-989e-7cd108f63a7d', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '{}'),
	('7c1e5839-4207-4b37-bbdd-16e6868df61e', 'public-assets', 'logo-1770008637057.png', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '2026-02-02 05:03:57.313747+00', '2026-02-02 05:03:57.313747+00', '2026-02-02 05:03:57.313747+00', '{"eTag": "\"e2306a978db1c11ecfa40e5e41b21fc2\"", "size": 36596, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-02-02T05:03:58.000Z", "contentLength": 36596, "httpStatusCode": 200}', '8a272f3c-2f09-410d-8557-c949325badfe', '01f183b3-82cf-455c-a2dd-c9a22a0e7511', '{}'),
	('39557f25-df7b-4998-b2cc-11079ae59873', 'payment-proofs', 'proof-262e1649-bcf9-4b6d-be98-508b45cbe8c6-1770197426828.png', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-02-04 09:30:28.130174+00', '2026-02-04 09:30:28.130174+00', '2026-02-04 09:30:28.130174+00', '{"eTag": "\"549d5f0de91cb98cae63350ea7b458bb\"", "size": 544576, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-02-04T09:30:29.000Z", "contentLength": 544576, "httpStatusCode": 200}', '69f09f3a-3c4d-4e71-8205-3a0fc3546a41', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{}'),
	('a2e77866-fcb7-4eaa-bce1-83c625f176e8', 'payment-proofs', 'proof-c9ab90ac-8027-462b-99f6-e8e1657669a0-1770630472760.jpg', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-02-09 09:47:54.006525+00', '2026-02-09 09:47:54.006525+00', '2026-02-09 09:47:54.006525+00', '{"eTag": "\"af9970be05def9b2956f9cc47ad3213f\"", "size": 119540, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-02-09T09:47:54.000Z", "contentLength": 119540, "httpStatusCode": 200}', 'eb79bbcf-9116-48ef-bf97-67725494dce2', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{}'),
	('ea5ae299-db23-44a2-8c8a-40fba286438a', 'payment-proofs', 'proof-c9ab90ac-8027-462b-99f6-e8e1657669a0-1770630485571.jpg', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-02-09 09:48:06.153494+00', '2026-02-09 09:48:06.153494+00', '2026-02-09 09:48:06.153494+00', '{"eTag": "\"af9970be05def9b2956f9cc47ad3213f\"", "size": 119540, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-02-09T09:48:07.000Z", "contentLength": 119540, "httpStatusCode": 200}', 'e371f102-58a3-4e89-8c1b-87c438c98c2a', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{}'),
	('d43a25a5-de4b-4e62-b69e-a7940b087348', 'payment-proofs', 'proof-c9ab90ac-8027-462b-99f6-e8e1657669a0-1770630876502.jpg', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-02-09 09:54:37.248089+00', '2026-02-09 09:54:37.248089+00', '2026-02-09 09:54:37.248089+00', '{"eTag": "\"af9970be05def9b2956f9cc47ad3213f\"", "size": 119540, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-02-09T09:54:38.000Z", "contentLength": 119540, "httpStatusCode": 200}', '63bcfd56-1e46-44b5-9403-4ec54ec476fd', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{}'),
	('4a83a660-8786-424e-add7-e3e12160dabb', 'payment-proofs', 'proof-c9ab90ac-8027-462b-99f6-e8e1657669a0-1770630962413.jpg', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-02-09 09:56:03.078512+00', '2026-02-09 09:56:03.078512+00', '2026-02-09 09:56:03.078512+00', '{"eTag": "\"af9970be05def9b2956f9cc47ad3213f\"", "size": 119540, "mimetype": "image/jpeg", "cacheControl": "max-age=3600", "lastModified": "2026-02-09T09:56:04.000Z", "contentLength": 119540, "httpStatusCode": 200}', '4495cc96-214d-404f-ad1f-a4e5091702e9', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{}'),
	('40ab5635-4b50-4d9e-9ae6-a35b0ae6d1f5', 'payment-proofs', 'proof-5f24db0b-9fc9-4032-a596-8663716a1dc5-1770633488969.png', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '2026-02-09 10:38:11.190319+00', '2026-02-09 10:38:11.190319+00', '2026-02-09 10:38:11.190319+00', '{"eTag": "\"549d5f0de91cb98cae63350ea7b458bb\"", "size": 544576, "mimetype": "image/png", "cacheControl": "max-age=3600", "lastModified": "2026-02-09T10:38:12.000Z", "contentLength": 544576, "httpStatusCode": 200}', '944777aa-57f6-4c9e-904e-804ac91283ab', '20b6700f-a5ce-43bc-ae2a-6af093f13b7e', '{}');


--
-- Data for Name: s3_multipart_uploads; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: s3_multipart_uploads_parts; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Data for Name: vector_indexes; Type: TABLE DATA; Schema: storage; Owner: supabase_storage_admin
--



--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE SET; Schema: auth; Owner: supabase_auth_admin
--

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 506, true);


--
-- Name: invoice_bill_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."invoice_bill_number_seq"', 12, true);


--
-- Name: quotation_number_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('"public"."quotation_number_seq"', 1, false);


--
-- PostgreSQL database dump complete
--

-- \unrestrict Q2Hr4ZzKUDEJr60N052PiRqCyG8bxzPAdHVFclhZSdCBvsgDgaLvgoSHNz52NTY

RESET ALL;
