--
-- PostgreSQL database dump
--

\restrict gVtyqr2XpLu22U8TongPw7alugiktv8deXAXFiQx2sWhEHO4aebBuQPvrr3iJ07

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: transaction_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transaction_status AS ENUM (
    'pending',
    'completed',
    'failed',
    'refunded'
);


ALTER TYPE public.transaction_status OWNER TO postgres;

--
-- Name: audit_transaction_status(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.audit_transaction_status() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF OLD.status <> NEW.status 
THEN INSERT INTO transactions_audit(transaction_id, old_status,new_status)
VALUES(OLD.id, OLD.status, NEW.status);

END IF;
RETURN NEW;
END;
$$;


ALTER FUNCTION public.audit_transaction_status() OWNER TO postgres;

--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN 
 NEW.updated_at = now();
 RETURN NEW;
 END;
 $$;


ALTER FUNCTION public.set_updated_at() OWNER TO postgres;

--
-- Name: transfer_money(text, text, numeric); Type: PROCEDURE; Schema: public; Owner: postgres
--

CREATE PROCEDURE public.transfer_money(IN sender_email text, IN receiver_email text, IN transfer_amount numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    sender_uuid UUID;
    receiver_uuid UUID;
	txn_id UUID;
BEGIN
-- RECUPERER LES UUIDS
SELECT id INTO sender_uuid FROM users WHERE email = sender_email;
SELECT id INTO receiver_uuid FROM users WHERE email = receiver_email;

-- CREER LA TRANSACTION
INSERT INTO transactions(sender_id, receiver_id,amount, status)
VALUES(sender_uuid, receiver_uuid, transfer_amount,'pending')
RETURNING id INTO txn_id;

--DEBITER SENDER
UPDATE users SET balance  = balance - transfer_amount
WHERE id = sender_uuid;

--CREDITER receiver 
UPDATE users SET balance = balance + transfer_amount
WHERE id = receiver_uuid;

--ENREGISTRER ledger
INSERT INTO ledger_entries(transaction_id, user_id,amount, direction)
VALUES(txn_id, sender_uuid, transfer_amount, 'debit');

INSERT INTO ledger_entries (transaction_id, user_id, amount, direction)
VALUES(txn_id, receiver_uuid, transfer_amount, 'credit');

END;
$$;


ALTER PROCEDURE public.transfer_money(IN sender_email text, IN receiver_email text, IN transfer_amount numeric) OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ledger_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ledger_entries (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    transaction_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(19,4) NOT NULL,
    direction character varying(6) NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT ledger_entries_direction_check CHECK (((direction)::text = ANY ((ARRAY['debit'::character varying, 'credit'::character varying])::text[])))
);


ALTER TABLE public.ledger_entries OWNER TO postgres;

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    amount numeric(19,4) NOT NULL,
    status public.transaction_status DEFAULT 'pending'::public.transaction_status,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_amount_positive CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.transactions OWNER TO postgres;

--
-- Name: transactions_audit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transactions_audit (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    transaction_id uuid NOT NULL,
    old_status public.transaction_status,
    new_status public.transaction_status,
    changed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.transactions_audit OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    username character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    balance numeric(19,4) DEFAULT 0,
    kyc_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT balance_positive CHECK ((balance >= (0)::numeric))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.wallets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    balance numeric(19,4) DEFAULT 0 NOT NULL,
    currency character varying(3) DEFAULT 'AED'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.wallets OWNER TO postgres;

--
-- Data for Name: ledger_entries; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.ledger_entries (id, transaction_id, user_id, amount, direction, created_at) FROM stdin;
f2419c62-8aac-4068-8ddb-6573f0ce6253	18144431-72a6-4632-a823-6d1e561025f4	f48ea36b-9411-4252-b7ce-9c1199e289e6	200.0000	debit	2026-06-11 02:32:45.965618+04
1e551614-1d10-4bae-bfdc-18e2806fd573	18144431-72a6-4632-a823-6d1e561025f4	c0d450df-8d56-4755-82a0-29346c38f4d7	200.0000	credit	2026-06-11 02:32:45.965618+04
888a4a1b-53e2-45a4-9afc-13b155abebf2	194731fe-4e90-4316-a2db-6d8d4c7eb680	f48ea36b-9411-4252-b7ce-9c1199e289e6	50.0000	debit	2026-06-12 01:23:00.97236+04
1fd02831-d370-4f16-b2bd-ac5f5c3074e5	194731fe-4e90-4316-a2db-6d8d4c7eb680	c0d450df-8d56-4755-82a0-29346c38f4d7	50.0000	credit	2026-06-12 01:23:00.97236+04
1b8387de-2c61-4658-9261-6e50e296a261	6ece088b-7166-401d-a7bb-cfd57f82a175	f48ea36b-9411-4252-b7ce-9c1199e289e6	50.0000	debit	2026-06-12 01:23:57.73862+04
ede0e085-d3d1-49f6-a381-1779eab9c98f	6ece088b-7166-401d-a7bb-cfd57f82a175	c0d450df-8d56-4755-82a0-29346c38f4d7	50.0000	credit	2026-06-12 01:23:57.73862+04
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions (id, sender_id, receiver_id, amount, status, created_at, updated_at) FROM stdin;
6b164eee-926b-4cca-8a95-6502a14d630d	f48ea36b-9411-4252-b7ce-9c1199e289e6	c0d450df-8d56-4755-82a0-29346c38f4d7	500.0000	pending	2026-06-10 11:37:39.622511+04	2026-06-11 11:46:46.521535+04
18144431-72a6-4632-a823-6d1e561025f4	f48ea36b-9411-4252-b7ce-9c1199e289e6	c0d450df-8d56-4755-82a0-29346c38f4d7	200.0000	pending	2026-06-11 02:32:45.965618+04	2026-06-11 11:46:46.521535+04
17ebd989-11a4-4022-8acd-454d7ff7f8b2	f48ea36b-9411-4252-b7ce-9c1199e289e6	c0d450df-8d56-4755-82a0-29346c38f4d7	500.0000	failed	2026-06-10 11:37:06.038363+04	2026-06-11 12:16:42.432908+04
194731fe-4e90-4316-a2db-6d8d4c7eb680	f48ea36b-9411-4252-b7ce-9c1199e289e6	c0d450df-8d56-4755-82a0-29346c38f4d7	50.0000	pending	2026-06-12 01:23:00.97236+04	2026-06-12 01:23:00.97236+04
6ece088b-7166-401d-a7bb-cfd57f82a175	f48ea36b-9411-4252-b7ce-9c1199e289e6	c0d450df-8d56-4755-82a0-29346c38f4d7	50.0000	pending	2026-06-12 01:23:57.73862+04	2026-06-12 01:23:57.73862+04
\.


--
-- Data for Name: transactions_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transactions_audit (id, transaction_id, old_status, new_status, changed_at) FROM stdin;
03b44f1e-97ec-4841-9c80-a29dc04743cd	17ebd989-11a4-4022-8acd-454d7ff7f8b2	completed	failed	2026-06-11 12:16:42.432908+04
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, email, password, balance, kyc_verified, is_active, created_at) FROM stdin;
66b442e1-72a2-4285-8eb8-5b6846615655	Sara	sara@balopay.com	hash789	0.0000	f	t	2026-06-09 17:04:08.264696+04
f48ea36b-9411-4252-b7ce-9c1199e289e6	Balomock Technology	balo@balopay.com	hash123	100.0000	f	t	2026-06-09 17:01:13.569158+04
c0d450df-8d56-4755-82a0-29346c38f4d7	Ali	ali@balopay.com	hash456	900.0000	f	t	2026-06-09 17:04:08.264696+04
\.


--
-- Data for Name: wallets; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.wallets (id, user_id, balance, currency, created_at) FROM stdin;
\.


--
-- Name: ledger_entries ledger_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_pkey PRIMARY KEY (id);


--
-- Name: transactions_audit transactions_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions_audit
    ADD CONSTRAINT transactions_audit_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: wallets wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_pkey PRIMARY KEY (id);


--
-- Name: wallets wallets_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_key UNIQUE (user_id);


--
-- Name: idx_transactions_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_created_at ON public.transactions USING btree (created_at);


--
-- Name: idx_transactions_receiver_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_receiver_id ON public.transactions USING btree (receiver_id);


--
-- Name: idx_transactions_sender_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_sender_id ON public.transactions USING btree (sender_id);


--
-- Name: idx_transactions_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transactions_status ON public.transactions USING btree (status);


--
-- Name: transactions trigger_audit_status; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_audit_status AFTER UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.audit_transaction_status();


--
-- Name: transactions trigger_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trigger_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: ledger_entries ledger_entries_transaction_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES public.transactions(id);


--
-- Name: ledger_entries ledger_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ledger_entries
    ADD CONSTRAINT ledger_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_recerver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_recerver_id_fkey FOREIGN KEY (receiver_id) REFERENCES public.users(id);


--
-- Name: transactions transactions_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: wallets wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.wallets
    ADD CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions transactions_isolation; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY transactions_isolation ON public.transactions USING (((sender_id = (current_setting('app.current_user'::text))::uuid) OR (receiver_id = (current_setting('app.current_user_id'::text))::uuid)));


--
-- PostgreSQL database dump complete
--

\unrestrict gVtyqr2XpLu22U8TongPw7alugiktv8deXAXFiQx2sWhEHO4aebBuQPvrr3iJ07

